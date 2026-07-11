import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface Checkpoint {
  id: string; // SDKUserMessage uuid — the userMessageId argument rewindFiles() expects
  label: string;
  createdAt: number;
}

/**
 * Tracks per-turn checkpoints (SDK-assigned user-message UUIDs) so Ctrl+Z
 * can call query.rewindFiles(). Each record() call is a new turn boundary;
 * undoTarget() steps one turn further back on every call until there's
 * nothing left, mirroring a normal editor undo stack (no redo in Phase 2).
 */
export class CheckpointTracker {
  private checkpoints: Checkpoint[] = [];
  private cursor = 0;

  record(id: string, label: string): void {
    this.checkpoints.push({ id, label, createdAt: Date.now() });
    this.cursor = this.checkpoints.length; // a new turn clears any pending "redo"
  }

  list(): readonly Checkpoint[] {
    return this.checkpoints;
  }

  /** The checkpoint the next Ctrl+Z would rewind to, or undefined if there's nothing left. */
  undoTarget(): Checkpoint | undefined {
    return this.cursor > 0 ? this.checkpoints[this.cursor - 1] : undefined;
  }

  /** Call once a rewind to undoTarget() succeeds, so the next Ctrl+Z steps further back. */
  confirmUndo(): void {
    if (this.cursor > 0) this.cursor -= 1;
  }
}

type Exec = (cmd: string, args: string[], cwd: string) => Promise<{ stdout: string }>;

const defaultExec: Exec = (cmd, args, cwd) => execFileAsync(cmd, args, { cwd });

/** True only when cwd is inside a git working tree. Never throws. */
export async function isGitRepo(cwd: string, exec: Exec = defaultExec): Promise<boolean> {
  try {
    await exec('git', ['rev-parse', '--is-inside-work-tree'], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * SDK checkpointing only tracks Write/Edit/NotebookEdit — this is the
 * fallback for Bash-caused changes. `git stash create` records a commit-ish
 * snapshot of the working tree WITHOUT touching the index, working tree, or
 * branch history (unlike `git stash push`), so it's safe to call before a
 * risky Bash command runs. Returns undefined (never throws) when cwd isn't
 * a git repo, the tree is clean, or git itself fails — a failed snapshot
 * must never block the tool call it's protecting.
 */
export async function snapshotGit(cwd: string, exec: Exec = defaultExec): Promise<string | undefined> {
  try {
    const { stdout } = await exec('git', ['stash', 'create'], cwd);
    const hash = stdout.trim();
    return hash || undefined; // empty stdout = clean tree, nothing to snapshot
  } catch {
    return undefined;
  }
}

/** Re-applies a snapshot captured by snapshotGit(). Never throws; returns success. */
export async function restoreGitSnapshot(cwd: string, hash: string, exec: Exec = defaultExec): Promise<boolean> {
  try {
    await exec('git', ['stash', 'apply', hash], cwd);
    return true;
  } catch {
    return false;
  }
}
