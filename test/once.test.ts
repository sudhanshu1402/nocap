import { describe, expect, it, vi } from 'vitest';
import { runOnce } from '../src/once.js';
import type { Query, QueryFn, SDKMessage } from '../src/sdk/types.js';

// Only the members SdkSession calls need to be real.
function asQuery(gen: AsyncGenerator<SDKMessage, void>): Query {
  return Object.assign(gen, {
    interrupt: async () => undefined,
    setPermissionMode: async () => undefined,
    setModel: async () => undefined,
    rewindFiles: async () => ({ canRewind: false }),
    close: () => undefined,
  }) as unknown as Query;
}

// A query that connects and then never yields a result message, which is what a
// stalled model call looks like from here.
const silentQuery: QueryFn = () =>
  asQuery(
    (async function* () {
      await new Promise(() => {});
    })(),
  );

describe('runOnce', () => {
  it('rejects instead of hanging when no result ever arrives', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      await expect(
        runOnce('hello', { queryFn: silentQuery, timeoutMs: 20 }),
      ).rejects.toThrow(/timed out after 20ms/);
    } finally {
      write.mockRestore();
    }
  });
});
