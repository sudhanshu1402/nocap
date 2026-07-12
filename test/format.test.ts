import { describe, expect, it } from 'vitest';
import { isSlashCommand, pluralize, shortenPath, truncate } from '../src/util/format.js';

describe('shortenPath', () => {
  it('strips a matching cwd prefix', () => {
    expect(shortenPath('/repo/src/index.ts', '/repo')).toBe('src/index.ts');
  });

  it('returns "." for the cwd itself', () => {
    expect(shortenPath('/repo', '/repo')).toBe('.');
  });

  it('collapses a home-directory prefix to ~', () => {
    const home = process.env.HOME ?? '/Users/test';
    const original = process.env.HOME;
    process.env.HOME = home;
    expect(shortenPath(`${home}/notes.md`, '/somewhere-else')).toBe('~/notes.md');
    process.env.HOME = original;
  });

  it('leaves unrelated absolute paths untouched', () => {
    expect(shortenPath('/etc/hosts', '/repo')).toBe('/etc/hosts');
  });

  it('passes through an empty path unchanged', () => {
    expect(shortenPath('', '/repo')).toBe('');
  });
});

describe('truncate', () => {
  it('leaves short text untouched', () => {
    expect(truncate('hello world', 60)).toBe('hello world');
  });

  it('truncates long text with an ellipsis, respecting max length', () => {
    const long = 'a'.repeat(100);
    const result = truncate(long, 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('…')).toBe(true);
  });

  it('collapses internal whitespace/newlines to single spaces', () => {
    expect(truncate('hello\n\n  world', 60)).toBe('hello world');
  });
});

describe('pluralize', () => {
  it('uses the singular noun for a count of exactly 1', () => {
    expect(pluralize(1, 'change')).toBe('1 change');
  });

  it('pluralizes for 0 and for counts above 1', () => {
    expect(pluralize(0, 'change')).toBe('0 changes');
    expect(pluralize(3, 'change')).toBe('3 changes');
  });
});

describe('isSlashCommand', () => {
  it('flags text starting with /', () => {
    expect(isSlashCommand('/mcp')).toBe(true);
  });

  it('flags leading whitespace before the slash', () => {
    expect(isSlashCommand('  /agents')).toBe(true);
  });

  it('leaves plain chat text alone, even mid-sentence slashes', () => {
    expect(isSlashCommand('check /etc/hosts for me')).toBe(false);
  });

  it('leaves empty input alone', () => {
    expect(isSlashCommand('')).toBe(false);
  });

  it('leaves a leading absolute file path alone', () => {
    expect(isSlashCommand('/Users/me/project/src/index.ts has a bug, fix it')).toBe(false);
  });

  it('leaves a leading multi-segment path alone even without an extension', () => {
    expect(isSlashCommand('/etc/nginx/nginx.conf needs a new server block')).toBe(false);
  });

  it('flags a namespaced plugin command', () => {
    expect(isSlashCommand('/figma:figma-use')).toBe(true);
  });
});
