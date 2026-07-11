export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok?: number;
  cacheReadPerMTok?: number;
}

/**
 * Approximate per-family pricing, USD per million tokens. Used ONLY to
 * smooth the live in-turn $ estimate between `result` messages — the
 * authoritative number is always the SDK's `result.total_cost_usd`, which
 * replaces this estimate the moment a turn finishes. Verify against
 * https://claude.com/pricing before trusting this table for anything else.
 */
export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  opus: { inputPerMTok: 15, outputPerMTok: 75, cacheWritePerMTok: 18.75, cacheReadPerMTok: 1.5 },
  sonnet: { inputPerMTok: 3, outputPerMTok: 15, cacheWritePerMTok: 3.75, cacheReadPerMTok: 0.3 },
  haiku: { inputPerMTok: 0.8, outputPerMTok: 4, cacheWritePerMTok: 1, cacheReadPerMTok: 0.08 },
};

function resolvePricing(model: string, pricing: Record<string, ModelPricing>): ModelPricing | undefined {
  const lower = model.toLowerCase();
  const key = Object.keys(pricing).find((family) => lower.includes(family));
  return key ? pricing[key] : undefined;
}

/**
 * Pure $ estimate for a chunk of token usage against a model's pricing.
 * Returns 0 (never throws, never guesses) when the model isn't recognized —
 * an unpriced live estimate should read as "no estimate yet", not a wrong number.
 */
export function estimateCost(
  usage: Partial<TokenUsage>,
  model: string,
  pricing: Record<string, ModelPricing> = DEFAULT_PRICING,
): number {
  const rate = resolvePricing(model, pricing);
  if (!rate) return 0;

  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  return (
    (input * rate.inputPerMTok) / 1_000_000 +
    (output * rate.outputPerMTok) / 1_000_000 +
    (cacheWrite * (rate.cacheWritePerMTok ?? rate.inputPerMTok)) / 1_000_000 +
    (cacheRead * (rate.cacheReadPerMTok ?? rate.inputPerMTok)) / 1_000_000
  );
}
