import { describe, expect, it, vi } from 'vitest';
import { ApprovalMachine } from '../src/permission/approvalMachine.js';
import { createCanUseTool } from '../src/permission/canUseTool.js';

function opts(overrides: Partial<Parameters<ReturnType<typeof createCanUseTool>>[2]> = {}) {
  return {
    signal: new AbortController().signal,
    toolUseID: 'toolu_1',
    requestId: 'req_1',
    ...overrides,
  } as Parameters<ReturnType<typeof createCanUseTool>>[2];
}

describe('createCanUseTool', () => {
  it('auto-allows read-only tools without touching the approval queue', async () => {
    const machine = new ApprovalMachine();
    const canUseTool = createCanUseTool(machine);

    const result = await canUseTool('Read', { file_path: '/tmp/a.txt' }, opts());

    expect(result).toEqual({ behavior: 'allow', updatedInput: { file_path: '/tmp/a.txt' } });
    expect(machine.pendingCount).toBe(0);
  });

  it('queues a pending request for a non-read-only tool and never auto-approves it', async () => {
    const machine = new ApprovalMachine();
    const canUseTool = createCanUseTool(machine);

    const pending = canUseTool('Write', { file_path: '/tmp/a.txt', content: 'x' }, opts({ toolUseID: 'toolu_2' }));

    expect(machine.pendingCount).toBe(1);
    expect(machine.current?.toolName).toBe('Write');
    expect(machine.current?.risk.level).toBe('medium');

    machine.approve('toolu_2');
    const result = await pending;
    expect(result?.behavior).toBe('allow');
  });

  it('attaches a high risk assessment for a destructive Bash command', async () => {
    const machine = new ApprovalMachine();
    const canUseTool = createCanUseTool(machine);

    const pending = canUseTool('Bash', { command: 'rm -rf ./dist' }, opts({ toolUseID: 'toolu_3' }));

    expect(machine.current?.risk.level).toBe('high');

    machine.deny('toolu_3');
    const result = await pending;
    expect(result?.behavior).toBe('deny');
  });

  it('denies a queued request when the SDK aborts the signal (e.g. interrupt)', async () => {
    const machine = new ApprovalMachine();
    const canUseTool = createCanUseTool(machine);
    const controller = new AbortController();

    const pending = canUseTool('Write', { file_path: '/tmp/a.txt' }, opts({ toolUseID: 'toolu_4', signal: controller.signal }));

    controller.abort();

    const result = await pending;
    expect(result?.behavior).toBe('deny');
    expect(machine.pendingCount).toBe(0);
  });

  it('snapshots git and reports the hash after an approved Bash call, when cwd is configured', async () => {
    const machine = new ApprovalMachine();
    const snapshots: Array<[string, string]> = [];
    const canUseTool = createCanUseTool(machine, {
      cwd: '/repo',
      onBashSnapshot: (toolUseId, hash) => snapshots.push([toolUseId, hash]),
      snapshotFn: async () => 'fake-hash',
    });

    const pending = canUseTool('Bash', { command: 'echo hi' }, opts({ toolUseID: 'toolu_5' }));
    machine.approve('toolu_5');
    const result = await pending;

    expect(result?.behavior).toBe('allow');
    expect(snapshots).toEqual([['toolu_5', 'fake-hash']]);
  });

  it('does not report a snapshot when the git working tree is clean (snapshotFn returns undefined)', async () => {
    const machine = new ApprovalMachine();
    const onBashSnapshot = vi.fn();
    const canUseTool = createCanUseTool(machine, { cwd: '/repo', onBashSnapshot, snapshotFn: async () => undefined });

    const pending = canUseTool('Bash', { command: 'echo hi' }, opts({ toolUseID: 'toolu_6' }));
    machine.approve('toolu_6');
    await pending;

    expect(onBashSnapshot).not.toHaveBeenCalled();
  });

  it('skips the git snapshot entirely when no cwd is configured', async () => {
    const machine = new ApprovalMachine();
    let snapshotCalled = false;
    const canUseTool = createCanUseTool(machine, {
      onBashSnapshot: () => {
        snapshotCalled = true;
      },
      snapshotFn: async () => 'fake-hash',
    });

    const pending = canUseTool('Bash', { command: 'echo hi' }, opts({ toolUseID: 'toolu_7' }));
    machine.approve('toolu_7');
    await pending;

    expect(snapshotCalled).toBe(false);
  });

  it('does not snapshot a denied Bash call', async () => {
    const machine = new ApprovalMachine();
    let snapshotCalled = false;
    const canUseTool = createCanUseTool(machine, {
      cwd: '/repo',
      onBashSnapshot: () => {
        snapshotCalled = true;
      },
      snapshotFn: async () => 'fake-hash',
    });

    const pending = canUseTool('Bash', { command: 'rm -rf ./dist' }, opts({ toolUseID: 'toolu_8' }));
    machine.deny('toolu_8');
    await pending;

    expect(snapshotCalled).toBe(false);
  });
});
