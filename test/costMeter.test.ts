import { describe, expect, it } from 'vitest';
import { estimateCost, type ModelPricing } from '../src/cost/costMeter.js';

const TEST_PRICING: Record<string, ModelPricing> = {
  cheap: { inputPerMTok: 1, outputPerMTok: 2, cacheWritePerMTok: 1.5, cacheReadPerMTok: 0.1 },
};

describe('estimateCost', () => {
  it('computes input + output cost at the given per-million-token rate', () => {
    const cost = estimateCost({ input_tokens: 1_000_000, output_tokens: 500_000 }, 'cheap-model', TEST_PRICING);
    expect(cost).toBeCloseTo(1 + 1, 10); // 1M in @ $1 + 0.5M out @ $2
  });

  it('folds in cache write and cache read tokens at their own rates', () => {
    const cost = estimateCost(
      { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 },
      'cheap-model',
      TEST_PRICING,
    );
    expect(cost).toBeCloseTo(1.5 + 0.1, 10);
  });

  it('falls back to the input rate for cache fields when a pricing table omits them', () => {
    const pricing: Record<string, ModelPricing> = { cheap: { inputPerMTok: 2, outputPerMTok: 10 } };
    const cost = estimateCost({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 }, 'cheap-model', pricing);
    expect(cost).toBeCloseTo(2, 10);
  });

  it('matches a model family by case-insensitive substring', () => {
    const a = estimateCost({ input_tokens: 1_000_000, output_tokens: 0 }, 'claude-CHEAP-4-x-20260101', TEST_PRICING);
    expect(a).toBeCloseTo(1, 10);
  });

  it('returns 0 for an unrecognized model, never throwing or guessing', () => {
    expect(() => estimateCost({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, 'some-unknown-model', TEST_PRICING)).not.toThrow();
    expect(estimateCost({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, 'some-unknown-model', TEST_PRICING)).toBe(0);
  });

  it('treats missing usage fields as 0 without throwing', () => {
    expect(estimateCost({}, 'cheap-model', TEST_PRICING)).toBe(0);
  });

  it('uses the built-in DEFAULT_PRICING table when none is supplied', () => {
    const cost = estimateCost({ input_tokens: 1_000_000, output_tokens: 0 }, 'claude-opus-4-8');
    expect(cost).toBeGreaterThan(0);
  });
});
