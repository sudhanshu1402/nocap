import { describe, expect, it } from 'vitest';
import { getSessionInfo, getSessionMessages, listRecentSessions } from '../src/history/sessions.js';
import type { SDKSessionInfo, SessionMessage } from '../src/sdk/types.js';

function session(overrides: Partial<SDKSessionInfo> = {}): SDKSessionInfo {
  return { sessionId: 'sid', summary: 'a session', lastModified: 0, ...overrides };
}

describe('listRecentSessions', () => {
  it('sorts sessions most-recently-modified first, regardless of input order', async () => {
    const unsorted = [
      session({ sessionId: 'old', lastModified: 100 }),
      session({ sessionId: 'newest', lastModified: 300 }),
      session({ sessionId: 'mid', lastModified: 200 }),
    ];
    const result = await listRecentSessions({ cwd: '/repo', listSessionsFn: async () => unsorted });

    expect(result.map((s) => s.sessionId)).toEqual(['newest', 'mid', 'old']);
  });

  it('passes cwd and a default limit through to the underlying listSessions call', async () => {
    let seenArgs: unknown;
    await listRecentSessions({
      cwd: '/repo',
      listSessionsFn: async (opts) => {
        seenArgs = opts;
        return [];
      },
    });

    expect(seenArgs).toEqual({ dir: '/repo', limit: 20 });
  });

  it('defaults cwd to process.cwd() when omitted', async () => {
    let seenArgs: unknown;
    await listRecentSessions({
      listSessionsFn: async (opts) => {
        seenArgs = opts;
        return [];
      },
    });

    expect((seenArgs as { dir: string }).dir).toBe(process.cwd());
  });
});

describe('getSessionInfo', () => {
  it('forwards sessionId and dir to the underlying getSessionInfo call', async () => {
    const expected = session({ sessionId: 'sid-1' });
    let seenId: string | undefined;
    let seenDir: string | undefined;

    const result = await getSessionInfo('sid-1', {
      cwd: '/repo',
      getSessionInfoFn: async (id, opts) => {
        seenId = id;
        seenDir = opts?.dir;
        return expected;
      },
    });

    expect(seenId).toBe('sid-1');
    expect(seenDir).toBe('/repo');
    expect(result).toBe(expected);
  });

  it('returns undefined when the underlying lookup finds nothing', async () => {
    const result = await getSessionInfo('missing', { getSessionInfoFn: async () => undefined });
    expect(result).toBeUndefined();
  });
});

describe('getSessionMessages', () => {
  it('forwards sessionId, dir, and limit to the underlying call', async () => {
    const messages: SessionMessage[] = [
      { type: 'user', uuid: 'u1', session_id: 'sid', message: {}, parent_tool_use_id: null, parent_agent_id: null },
    ];
    let seenId: string | undefined;
    let seenOpts: unknown;

    const result = await getSessionMessages('sid', {
      cwd: '/repo',
      limit: 5,
      getSessionMessagesFn: async (id, opts) => {
        seenId = id;
        seenOpts = opts;
        return messages;
      },
    });

    expect(seenId).toBe('sid');
    expect(seenOpts).toEqual({ dir: '/repo', limit: 5 });
    expect(result).toBe(messages);
  });
});
