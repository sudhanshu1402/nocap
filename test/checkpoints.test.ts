import { describe, expect, it } from 'vitest';
import { CheckpointTracker, isGitRepo, restoreGitSnapshot, snapshotGit } from '../src/checkpoint/checkpoints.js';

describe('CheckpointTracker', () => {
  it('has no undo target before any turn is recorded', () => {
    const tracker = new CheckpointTracker();
    expect(tracker.undoTarget()).toBeUndefined();
    expect(tracker.list()).toEqual([]);
  });

  it('targets the most recently recorded checkpoint first', () => {
    const tracker = new CheckpointTracker();
    tracker.record('uuid-1', 'turn 1');
    tracker.record('uuid-2', 'turn 2');

    expect(tracker.undoTarget()?.id).toBe('uuid-2');
  });

  it('steps one turn further back each time confirmUndo() is called', () => {
    const tracker = new CheckpointTracker();
    tracker.record('uuid-1', 'turn 1');
    tracker.record('uuid-2', 'turn 2');
    tracker.record('uuid-3', 'turn 3');

    expect(tracker.undoTarget()?.id).toBe('uuid-3');
    tracker.confirmUndo();
    expect(tracker.undoTarget()?.id).toBe('uuid-2');
    tracker.confirmUndo();
    expect(tracker.undoTarget()?.id).toBe('uuid-1');
    tracker.confirmUndo();
    expect(tracker.undoTarget()).toBeUndefined();
  });

  it('does not step past the oldest checkpoint', () => {
    const tracker = new CheckpointTracker();
    tracker.record('uuid-1', 'turn 1');
    tracker.confirmUndo();
    tracker.confirmUndo(); // extra call past the end must be a no-op

    expect(tracker.undoTarget()).toBeUndefined();
  });

  it('recording a new turn resets the cursor past any pending redo state', () => {
    const tracker = new CheckpointTracker();
    tracker.record('uuid-1', 'turn 1');
    tracker.record('uuid-2', 'turn 2');
    tracker.confirmUndo(); // cursor now points at uuid-1

    tracker.record('uuid-3', 'turn 3');
    expect(tracker.undoTarget()?.id).toBe('uuid-3');
  });

  it('list() returns every recorded checkpoint in order', () => {
    const tracker = new CheckpointTracker();
    tracker.record('uuid-1', 'turn 1');
    tracker.record('uuid-2', 'turn 2');

    expect(tracker.list().map((c) => c.id)).toEqual(['uuid-1', 'uuid-2']);
  });
});

describe('isGitRepo', () => {
  it('resolves true when git rev-parse succeeds', async () => {
    const exec = async () => ({ stdout: 'true\n' });
    expect(await isGitRepo('/repo', exec)).toBe(true);
  });

  it('resolves false (never throws) when git rev-parse fails', async () => {
    const exec = async () => {
      throw new Error('not a git repository');
    };
    expect(await isGitRepo('/not-a-repo', exec)).toBe(false);
  });
});

describe('snapshotGit', () => {
  it('returns the stash hash when the working tree has changes', async () => {
    const exec = async () => ({ stdout: 'abc123\n' });
    expect(await snapshotGit('/repo', exec)).toBe('abc123');
  });

  it('returns undefined when the working tree is clean (empty stdout)', async () => {
    const exec = async () => ({ stdout: '\n' });
    expect(await snapshotGit('/repo', exec)).toBeUndefined();
  });

  it('returns undefined (never throws) when git fails or cwd is not a repo', async () => {
    const exec = async () => {
      throw new Error('fatal: not a git repository');
    };
    await expect(snapshotGit('/not-a-repo', exec)).resolves.toBeUndefined();
  });
});

describe('restoreGitSnapshot', () => {
  it('returns true when git stash apply succeeds', async () => {
    const exec = async () => ({ stdout: '' });
    expect(await restoreGitSnapshot('/repo', 'abc123', exec)).toBe(true);
  });

  it('returns false (never throws) when git stash apply fails', async () => {
    const exec = async () => {
      throw new Error('could not apply stash');
    };
    expect(await restoreGitSnapshot('/repo', 'deadbeef', exec)).toBe(false);
  });
});
