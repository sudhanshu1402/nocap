import { describe, expect, it } from 'vitest';
import { looksLikeApiKey } from '../src/wizard/validate.js';
import { MODEL_CHOICES } from '../src/wizard/models.js';

describe('looksLikeApiKey', () => {
  it('accepts a well-formed Anthropic key', () => {
    expect(looksLikeApiKey('sk-ant-api03-abcdefghijklmnop')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(looksLikeApiKey('  sk-ant-api03-abcdefghijklmnop  ')).toBe(true);
  });

  it('rejects keys missing the sk-ant- prefix', () => {
    expect(looksLikeApiKey('sk-abcdefghijklmnop')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(looksLikeApiKey('')).toBe(false);
  });

  it('rejects a too-short suffix', () => {
    expect(looksLikeApiKey('sk-ant-short')).toBe(false);
  });
});

describe('MODEL_CHOICES', () => {
  it('is non-empty and every entry has an id, label, and hint', () => {
    expect(MODEL_CHOICES.length).toBeGreaterThan(0);
    for (const choice of MODEL_CHOICES) {
      expect(choice.id.length).toBeGreaterThan(0);
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.hint.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate model ids', () => {
    const ids = MODEL_CHOICES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
