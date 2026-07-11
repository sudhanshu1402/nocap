import { describe, expect, it } from 'vitest';
import { hasClaudeCliAuth } from '../src/config/claudeAuth.js';

describe('hasClaudeCliAuth', () => {
  it('returns true when claude reports loggedIn', () => {
    expect(hasClaudeCliAuth(() => JSON.stringify({ loggedIn: true }))).toBe(true);
  });

  it('returns false when claude reports logged out', () => {
    expect(hasClaudeCliAuth(() => JSON.stringify({ loggedIn: false }))).toBe(false);
  });

  it('returns false when claude is not installed', () => {
    expect(
      hasClaudeCliAuth(() => {
        throw new Error('ENOENT');
      }),
    ).toBe(false);
  });

  it('returns false on unparseable output', () => {
    expect(hasClaudeCliAuth(() => 'not json')).toBe(false);
  });
});
