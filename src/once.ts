import { SdkSession } from './sdk/session.js';
import { buildOptions, isAutoAllowedReadOnly } from './sdk/options.js';
import { isTextBlock, isToolUseBlock } from './sdk/types.js';
import { narrate } from './narrator/narrate.js';
import { classifyRisk } from './permission/riskClassifier.js';
import { redact } from './util/redact.js';
import type { CanUseTool, QueryFn } from './sdk/types.js';

export interface RunOnceConfig {
  apiKey?: string;
  model?: string;
  cwd?: string;
  resume?: string; // set by --continue/--resume so --once can also target a past session
  queryFn?: QueryFn; // injectable for tests
}

export interface RunOnceResult {
  ok: boolean;
}

/**
 * Headless single-turn mode (`nocap --once "<prompt>"`) for scripting and
 * automated verification without a live terminal. There is no UI to show an
 * approval card, so anything beyond the read-only allowlist is auto-denied
 * — never auto-approved, even here — and reported to stderr with the reason.
 */
const headlessCanUseTool: CanUseTool = async (toolName, input) => {
  if (isAutoAllowedReadOnly(toolName)) {
    return { behavior: 'allow', updatedInput: input };
  }
  const risk = classifyRisk(toolName, input);
  return {
    behavior: 'deny',
    message: `headless mode (--once) never approves actions automatically — rerun "nocap" interactively to allow "${toolName}" (${risk.reason})`,
  };
};

export async function runOnce(prompt: string, config: RunOnceConfig): Promise<RunOnceResult> {
  const session = new SdkSession(config.queryFn);

  return new Promise<RunOnceResult>((resolve, reject) => {
    let settled = false;

    const finish = (result: RunOnceResult): void => {
      if (settled) return;
      settled = true;
      unsubMessage();
      unsubError();
      session.close();
      resolve(result);
    };

    const unsubMessage = session.onMessage((msg) => {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (isTextBlock(block)) {
            process.stdout.write(redact(block.text));
          } else if (isToolUseBlock(block)) {
            const line = narrate(block.id, block.name, block.input);
            process.stderr.write(`· ${line.text}\n`);
          }
        }
      } else if (msg.type === 'system' && msg.subtype === 'permission_denied') {
        process.stderr.write(`· blocked: ${msg.tool_name} — ${redact(msg.message)}\n`);
      } else if (msg.type === 'result') {
        process.stdout.write('\n');
        finish({ ok: !msg.is_error });
      }
    });

    const unsubError = session.onError((err) => {
      if (settled) return;
      settled = true;
      unsubMessage();
      session.close();
      reject(err instanceof Error ? err : new Error(String(err)));
    });

    session.start(
      buildOptions({
        apiKey: config.apiKey,
        model: config.model,
        cwd: config.cwd,
        canUseTool: headlessCanUseTool,
        permissionMode: 'default',
        resume: config.resume,
      }),
    );
    session.send(prompt);
    session.endInput(); // one-shot: no more turns coming, but let this response finish
  });
}
