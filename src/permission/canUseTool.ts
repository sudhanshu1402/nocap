import { isAutoAllowedReadOnly } from '../sdk/options.js';
import { classifyRisk } from './riskClassifier.js';
import { snapshotGit } from '../checkpoint/checkpoints.js';
import type { ApprovalMachine } from './approvalMachine.js';
import type { CanUseTool } from '../sdk/types.js';

export interface CanUseToolOptions {
  /** cwd to snapshot before an approved Bash call — omit to skip the git fallback entirely. */
  cwd?: string;
  /** Called with the toolUseId + git stash hash right after a Bash call is approved. */
  onBashSnapshot?: (toolUseId: string, hash: string) => void;
  /** Injectable for tests — defaults to the real snapshotGit(). */
  snapshotFn?: typeof snapshotGit;
}

/**
 * Bridges the SDK's canUseTool callback to the ApprovalMachine. Read-only
 * tools skip the queue entirely; everything else becomes a pending request
 * the UI must explicitly approve or deny — never auto-approved here.
 *
 * SDK file-checkpointing (Query.rewindFiles) only tracks Write/Edit/
 * NotebookEdit, so once a Bash call is approved we best-effort snapshot the
 * git working tree as a fallback undo point (see checkpoint/checkpoints.ts).
 * A snapshot failure never blocks or delays the approved tool call.
 */
export function createCanUseTool(machine: ApprovalMachine, options: CanUseToolOptions = {}): CanUseTool {
  return async (toolName, input, opts) => {
    if (isAutoAllowedReadOnly(toolName)) {
      return { behavior: 'allow', updatedInput: input };
    }
    const risk = classifyRisk(toolName, input);
    const result = await machine.request(
      {
        id: opts.toolUseID,
        toolName,
        input,
        title: opts.title,
        displayName: opts.displayName,
        description: opts.description,
        suggestions: opts.suggestions,
        risk,
        createdAt: Date.now(),
      },
      opts.signal,
    );
    if (result?.behavior === 'allow' && toolName === 'Bash' && options.cwd) {
      // Awaited so the snapshot is taken before the SDK proceeds to run the
      // command — snapshotGit() never throws, so this can't fail the call.
      const snapshot = options.snapshotFn ?? snapshotGit;
      const hash = await snapshot(options.cwd);
      if (hash) options.onBashSnapshot?.(opts.toolUseID, hash);
    }
    return result;
  };
}
