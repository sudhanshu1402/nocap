import { describe, expect, it, vi } from 'vitest';
import { ApprovalMachine, type ApprovalRequest } from '../src/permission/approvalMachine.js';
import type { PermissionUpdate } from '../src/sdk/types.js';

function makeRequest(id: string, overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id,
    toolName: 'Write',
    input: { file_path: '/tmp/a.txt', content: 'hi' },
    risk: { level: 'medium', reason: 'creates or overwrites a file' },
    createdAt: 0,
    ...overrides,
  };
}

describe('ApprovalMachine', () => {
  it('starts idle: no current request, empty queue', () => {
    const machine = new ApprovalMachine();
    expect(machine.current).toBeUndefined();
    expect(machine.pendingCount).toBe(0);
  });

  it('queues a request and notifies listeners', () => {
    const machine = new ApprovalMachine();
    const onChange = vi.fn();
    machine.onChange(onChange);

    void machine.request(makeRequest('a'));

    expect(machine.pendingCount).toBe(1);
    expect(machine.current?.id).toBe('a');
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'a' })]);
  });

  it('approve() resolves the promise with an allow result carrying the original input', async () => {
    const machine = new ApprovalMachine();
    const promise = machine.request(makeRequest('a'));

    machine.approve('a');

    await expect(promise).resolves.toEqual({
      behavior: 'allow',
      updatedInput: { file_path: '/tmp/a.txt', content: 'hi' },
      updatedPermissions: undefined,
    });
    expect(machine.pendingCount).toBe(0);
    expect(machine.current).toBeUndefined();
  });

  it('approve({remember: true}) carries the request suggestions as updatedPermissions', async () => {
    const machine = new ApprovalMachine();
    const suggestions = [{ type: 'addRules' }] as unknown as PermissionUpdate[];
    const promise = machine.request(makeRequest('a', { suggestions }));

    machine.approve('a', { remember: true });

    const result = await promise;
    expect(result).toMatchObject({ behavior: 'allow', updatedPermissions: suggestions });
  });

  it('deny() resolves the promise with a deny result, default message', async () => {
    const machine = new ApprovalMachine();
    const promise = machine.request(makeRequest('a'));

    machine.deny('a');

    await expect(promise).resolves.toEqual({ behavior: 'deny', message: 'denied by user' });
  });

  it('deny() accepts a custom message', async () => {
    const machine = new ApprovalMachine();
    const promise = machine.request(makeRequest('a'));

    machine.deny('a', 'not today');

    await expect(promise).resolves.toEqual({ behavior: 'deny', message: 'not today' });
  });

  it('never auto-approves: a request stays pending until approve/deny/abort is called', async () => {
    const machine = new ApprovalMachine();
    let settled = false;
    void machine.request(makeRequest('a')).then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(settled).toBe(false);
    expect(machine.pendingCount).toBe(1);
  });

  it('queues concurrent requests in order and resolves them independently', async () => {
    const machine = new ApprovalMachine();
    const first = machine.request(makeRequest('a'));
    const second = machine.request(makeRequest('b'));

    expect(machine.pendingCount).toBe(2);
    expect(machine.current?.id).toBe('a');

    machine.approve('a');
    const firstResult = await first;
    expect(firstResult.behavior).toBe('allow');

    // second request is untouched by the first settling
    expect(machine.pendingCount).toBe(1);
    expect(machine.current?.id).toBe('b');

    machine.deny('b', 'no thanks');
    const secondResult = await second;
    expect(secondResult).toEqual({ behavior: 'deny', message: 'no thanks' });
    expect(machine.pendingCount).toBe(0);
  });

  it('approve() on an unknown or already-settled id is a silent no-op', async () => {
    const machine = new ApprovalMachine();
    const promise = machine.request(makeRequest('a'));

    machine.approve('a');
    await promise;

    expect(() => machine.approve('a')).not.toThrow();
    expect(() => machine.deny('a')).not.toThrow();
    expect(() => machine.approve('never-existed')).not.toThrow();
  });

  it('auto-denies (never auto-allows) when the abort signal fires', async () => {
    const machine = new ApprovalMachine();
    const controller = new AbortController();
    const promise = machine.request(makeRequest('a'), controller.signal);

    controller.abort();

    await expect(promise).resolves.toEqual({
      behavior: 'deny',
      message: 'cancelled — turn was interrupted',
    });
    expect(machine.pendingCount).toBe(0);
  });

  it('auto-denies immediately if the signal is already aborted at request time', async () => {
    const machine = new ApprovalMachine();
    const controller = new AbortController();
    controller.abort();

    const promise = machine.request(makeRequest('a'), controller.signal);

    await expect(promise).resolves.toEqual({
      behavior: 'deny',
      message: 'cancelled — turn was interrupted',
    });
    expect(machine.pendingCount).toBe(0);
  });

  // The settler map is keyed by toolUseID. A second request under the same id
  // used to overwrite the first settler, leaving that canUseTool promise pending
  // for the rest of the session.
  it('denies a superseded request instead of orphaning it', async () => {
    const machine = new ApprovalMachine();
    const first = machine.request(makeRequest('a'));
    const second = machine.request(makeRequest('a', { toolName: 'Bash' }));

    await expect(first).resolves.toEqual({
      behavior: 'deny',
      message: 'superseded by a newer request for the same tool use',
    });
    expect(machine.pendingCount).toBe(1);
    expect(machine.current?.toolName).toBe('Bash');

    machine.deny('a');
    await expect(second).resolves.toMatchObject({ behavior: 'deny' });
  });

  // One turn signal serves every approval in that turn, so a listener left
  // behind per settled request accumulates for the whole turn.
  it('removes its abort listener once the request settles', async () => {
    const machine = new ApprovalMachine();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    const promise = machine.request(makeRequest('a'), controller.signal);
    machine.approve('a');
    await promise;

    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('onChange() unsubscribe stops further notifications', () => {
    const machine = new ApprovalMachine();
    const onChange = vi.fn();
    const unsubscribe = machine.onChange(onChange);
    unsubscribe();

    void machine.request(makeRequest('a'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
