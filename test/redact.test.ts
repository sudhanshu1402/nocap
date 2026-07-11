import { describe, expect, it } from 'vitest';
import { redact } from '../src/util/redact.js';

describe('redact', () => {
  it('scrubs an Anthropic API key', () => {
    const text = 'export ANTHROPIC_API_KEY=sk-ant-api03-abcdefgh12345678';
    expect(redact(text)).toBe('export ANTHROPIC_API_KEY=[redacted]');
  });

  it('scrubs a generic OpenAI-style secret key', () => {
    const text = 'key: sk-abcdefghijklmnopqrstuvwx1234';
    expect(redact(text)).not.toContain('sk-abcdefghijklmnopqrstuvwx1234');
  });

  it('scrubs a Bearer token', () => {
    const text = 'Authorization: Bearer abcdefghij1234567890';
    expect(redact(text)).toBe('Authorization: [redacted]');
  });

  it('scrubs a GitHub token', () => {
    const text = `token=ghp_${'a'.repeat(36)}`;
    expect(redact(text)).toBe('token=[redacted]');
  });

  it('scrubs a Slack token', () => {
    const text = 'xoxb-1234567890-abcdefghij';
    expect(redact(text)).toBe('[redacted]');
  });

  it('scrubs multiple secrets in the same string', () => {
    const text = 'key sk-ant-api03-abcdefgh12345678 and Bearer abcdefghij1234567890';
    const result = redact(text);
    expect(result).not.toContain('sk-ant-');
    expect(result).not.toContain('Bearer abcdefghij1234567890');
    expect(result.match(/\[redacted\]/g)).toHaveLength(2);
  });

  it('leaves ordinary text untouched', () => {
    const text = 'reading src/index.ts and writing a summary';
    expect(redact(text)).toBe(text);
  });

  it('does not mangle short, non-secret-shaped tokens', () => {
    const text = 'sk-short';
    expect(redact(text)).toBe(text);
  });
});
