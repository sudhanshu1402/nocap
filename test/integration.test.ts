import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApprovalMachine } from '../src/permission/approvalMachine.js';
import { createCanUseTool } from '../src/permission/canUseTool.js';
import { narrate, type InsightLine } from '../src/narrator/narrate.js';
import { CheckpointTracker } from '../src/checkpoint/checkpoints.js';
import { redact } from '../src/util/redact.js';
import { buildOptions } from '../src/sdk/options.js';
import { SdkSession } from '../src/sdk/session.js';
import { isTextBlock, isToolUseBlock } from '../src/sdk/types.js';
import type {
  Options,
  Query,
  RewindFilesResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
} from '../src/sdk/types.js';

// Wraps a plain async generator of scripted SDKMessages as a Query: only the
// members SdkSession actually calls need to be real, the rest of the (large)
// Query interface is irrelevant to this test. rewindFiles is overridable so
// the checkpoint/undo test can script a realistic RewindFilesResult.
function asQuery(gen: AsyncGenerator<SDKMessage, void>, rewindFiles?: Query['rewindFiles']): Query {
  return Object.assign(gen, {
    interrupt: async () => undefined,
    setPermissionMode: async () => undefined,
    setModel: async () => undefined,
    rewindFiles: rewindFiles ?? (async () => ({ canRewind: false })),
    close: () => undefined,
  }) as unknown as Query;
}

const sessionId = randomUUID();
// shortenPath() strips a matching process.cwd() prefix, so test file paths
// must live under it for the narrator's "writing note.txt"-style output.
const notePath = `${process.cwd()}/note.txt`;

function initMessage(): SDKSystemMessage {
  return {
    type: 'system',
    subtype: 'init',
    model: 'claude-opus-4-8',
    permissionMode: 'default',
    cwd: '/tmp/nocap-test',
    tools: ['Write'],
    mcp_servers: [],
    slash_commands: [],
    output_style: 'default',
    skills: [],
    plugins: [],
    apiKeySource: 'user',
    claude_code_version: '0.0.0-test',
    uuid: randomUUID(),
    session_id: sessionId,
  } as unknown as SDKSystemMessage;
}

function assistantTextMessage(text: string): SDKAssistantMessage {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
    uuid: randomUUID(),
    session_id: sessionId,
  } as unknown as SDKAssistantMessage;
}

function assistantToolUseMessage(id: string, name: string, input: Record<string, unknown>): SDKAssistantMessage {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] },
    parent_tool_use_id: null,
    uuid: randomUUID(),
    session_id: sessionId,
  } as unknown as SDKAssistantMessage;
}

function resultMessage(overrides: Record<string, unknown> = {}): SDKResultMessage {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 120,
    duration_api_ms: 90,
    num_turns: 1,
    result: 'done',
    stop_reason: null,
    total_cost_usd: 0.0123,
    usage: {},
    modelUsage: {},
    permission_denials: [],
    uuid: randomUUID(),
    session_id: sessionId,
    ...overrides,
  } as unknown as SDKResultMessage;
}

// Mirrors the subset of App.tsx's handleMessage switch this test exercises:
// text -> transcript, tool_use -> narrated insight, permission_denied ->
// redacted transcript notice, result -> final cost/status, user echo ->
// checkpoint record. Kept in the test so the assertions read as plain state,
// without pulling in Ink/React.
interface Harness {
  transcript: string[];
  insights: InsightLine[];
  costUsd?: number;
  errored: boolean;
  checkpoints: CheckpointTracker;
  handle(msg: SDKMessage): void;
}

function createHarness(): Harness {
  let turn = 0;
  const harness: Harness = {
    transcript: [],
    insights: [],
    errored: false,
    checkpoints: new CheckpointTracker(),
    handle(msg) {
      switch (msg.type) {
        case 'system': {
          if (msg.subtype === 'permission_denied') {
            harness.transcript.push(`blocked: ${msg.tool_name} — ${redact(msg.message)}`);
          }
          break;
        }
        case 'assistant': {
          for (const block of msg.message.content as Array<{ type: string }>) {
            if (isTextBlock(block)) {
              harness.transcript.push(block.text);
            } else if (isToolUseBlock(block)) {
              harness.insights.push(narrate(block.id, block.name, block.input));
            }
          }
          break;
        }
        case 'result': {
          harness.errored = msg.is_error;
          harness.costUsd = msg.total_cost_usd;
          break;
        }
        case 'user': {
          if (msg.uuid) {
            turn += 1;
            harness.checkpoints.record(msg.uuid, `turn ${turn}`);
          }
          break;
        }
        default:
          break;
      }
    },
  };
  return harness;
}

describe('full session round-trip against a mock SDK', () => {
  it('narrates a tool use, prompts for approval, and settles once approved', async () => {
    const machine = new ApprovalMachine();
    const harness = createHarness();
    let capturedOptions: Options | undefined;

    const session = new SdkSession(({ options }) => {
      capturedOptions = options;
      async function* script(): AsyncGenerator<SDKMessage, void> {
        yield initMessage();
        yield assistantTextMessage("I'll create a note for you.");
        yield assistantToolUseMessage('toolu_write_1', 'Write', {
          file_path: notePath,
          content: 'hello',
        });
        // The real SDK calls canUseTool internally once it reaches a tool
        // that needs a permission decision — the mock does the same so this
        // test exercises the real ApprovalMachine + canUseTool bridge.
        const decision = await options!.canUseTool!(
          'Write',
          { file_path: notePath, content: 'hello' },
          { signal: new AbortController().signal, toolUseID: 'toolu_write_1', requestId: 'req_1' },
        );
        if (decision?.behavior === 'deny') {
          yield {
            type: 'system',
            subtype: 'permission_denied',
            tool_name: 'Write',
            tool_use_id: 'toolu_write_1',
            message: decision.message,
            uuid: randomUUID(),
            session_id: sessionId,
          } as unknown as SDKMessage;
        }
        yield resultMessage();
      }
      return asQuery(script());
    });

    const received: SDKMessage[] = [];
    session.onMessage((msg) => {
      received.push(msg);
      harness.handle(msg);
    });

    session.start(
      buildOptions({
        apiKey: 'test-key',
        canUseTool: createCanUseTool(machine),
        permissionMode: 'default',
      }),
    );

    // Let the mock generator run up to the point where it's blocked on the
    // approval promise.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(machine.pendingCount).toBe(1);
    expect(machine.current?.toolName).toBe('Write');
    expect(harness.insights).toEqual([{ id: 'toolu_write_1', toolName: 'Write', text: 'writing note.txt', risk: 'medium' }]);
    expect(harness.transcript).toEqual(["I'll create a note for you."]);

    machine.approve('toolu_write_1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(machine.pendingCount).toBe(0);
    expect(harness.errored).toBe(false);
    expect(harness.costUsd).toBe(0.0123);
    expect(received.map((m) => m.type)).toEqual(['system', 'assistant', 'assistant', 'result']);
    expect(capturedOptions?.cwd).toBe(process.cwd());

    session.close();
  });

  it('never auto-approves: denying the request short-circuits the tool and is reflected in the transcript, redacted', async () => {
    const machine = new ApprovalMachine();
    const harness = createHarness();

    const session = new SdkSession(({ options }) => {
      async function* script(): AsyncGenerator<SDKMessage, void> {
        yield initMessage();
        yield assistantToolUseMessage('toolu_bash_1', 'Bash', { command: 'rm -rf ./dist' });
        const decision = await options!.canUseTool!(
          'Bash',
          { command: 'rm -rf ./dist' },
          { signal: new AbortController().signal, toolUseID: 'toolu_bash_1', requestId: 'req_2' },
        );
        if (decision?.behavior === 'deny') {
          yield {
            type: 'system',
            subtype: 'permission_denied',
            tool_name: 'Bash',
            tool_use_id: 'toolu_bash_1',
            message: `denied — leaked sk-ant-api03-abcdefgh12345678 in the reason`,
            uuid: randomUUID(),
            session_id: sessionId,
          } as unknown as SDKMessage;
        }
        yield resultMessage();
      }
      return asQuery(script());
    });

    session.onMessage((msg) => harness.handle(msg));
    session.start(
      buildOptions({ apiKey: 'test-key', canUseTool: createCanUseTool(machine), permissionMode: 'default' }),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(machine.current?.risk.level).toBe('high');

    machine.deny('toolu_bash_1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(harness.transcript).toEqual(['blocked: Bash — denied — leaked [redacted] in the reason']);
    session.close();
  });

  it('auto-allows read-only tools without ever creating an approval request', async () => {
    const machine = new ApprovalMachine();
    const harness = createHarness();

    const session = new SdkSession(({ options }) => {
      async function* script(): AsyncGenerator<SDKMessage, void> {
        yield initMessage();
        yield assistantToolUseMessage('toolu_read_1', 'Read', { file_path: notePath });
        const decision = await options!.canUseTool!(
          'Read',
          { file_path: notePath },
          { signal: new AbortController().signal, toolUseID: 'toolu_read_1', requestId: 'req_3' },
        );
        expect(decision).toEqual({ behavior: 'allow', updatedInput: { file_path: notePath } });
        yield resultMessage();
      }
      return asQuery(script());
    });

    session.onMessage((msg) => harness.handle(msg));
    session.start(
      buildOptions({ apiKey: 'test-key', canUseTool: createCanUseTool(machine), permissionMode: 'default' }),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(machine.pendingCount).toBe(0);
    expect(harness.insights).toEqual([{ id: 'toolu_read_1', toolName: 'Read', text: 'reading note.txt', risk: 'low' }]);
    session.close();
  });

  it('records a checkpoint from the replayed user-message echo and undoes it via rewindFiles', async () => {
    const machine = new ApprovalMachine();
    const harness = createHarness();
    const checkpointUuid = randomUUID();

    const rewindFiles = async (userMessageId: string): Promise<RewindFilesResult> => {
      expect(userMessageId).toBe(checkpointUuid);
      return { canRewind: true, filesChanged: ['note.txt'], insertions: 1, deletions: 0 };
    };

    const session = new SdkSession(() => {
      async function* script(): AsyncGenerator<SDKMessage, void> {
        yield initMessage();
        // The SDK echoes the submitted user message back (extraArgs sets
        // 'replay-user-messages') carrying the uuid rewindFiles() expects.
        yield {
          type: 'user',
          message: { role: 'user', content: 'add a note' },
          parent_tool_use_id: null,
          uuid: checkpointUuid,
          session_id: sessionId,
        } as unknown as SDKMessage;
        yield assistantToolUseMessage('toolu_write_2', 'Write', { file_path: notePath, content: 'hello' });
        yield resultMessage();
      }
      return asQuery(script(), rewindFiles);
    });

    session.onMessage((msg) => harness.handle(msg));
    session.start(
      buildOptions({ apiKey: 'test-key', canUseTool: createCanUseTool(machine), permissionMode: 'default' }),
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    const target = harness.checkpoints.undoTarget();
    expect(target?.id).toBe(checkpointUuid);

    const result = await session.rewindFiles(target!.id);
    expect(result).toEqual({ canRewind: true, filesChanged: ['note.txt'], insertions: 1, deletions: 0 });

    harness.checkpoints.confirmUndo();
    expect(harness.checkpoints.undoTarget()).toBeUndefined();

    session.close();
  });
});
