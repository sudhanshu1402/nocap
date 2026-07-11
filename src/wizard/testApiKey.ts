import Anthropic from '@anthropic-ai/sdk';

export type TestApiKeyFn = (apiKey: string) => Promise<{ ok: boolean; message: string }>;

/** Minimal live probe — 1 output token, cheapest model. Optional wizard step, never required. */
export const testApiKey: TestApiKeyFn = async (apiKey) => {
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    return { ok: true, message: 'key looks valid' };
  } catch (err) {
    // Only a genuine 401 means the key itself is bad — network errors, rate
    // limits, and overloaded-server responses aren't the key's fault and
    // shouldn't be reported as "rejected".
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, message: 'key was rejected: invalid API key' };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `couldn't verify the key: ${message}` };
  }
};
