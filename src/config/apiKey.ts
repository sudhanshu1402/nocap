import { CONFIG_PATH, readConfig } from './config.js';

/**
 * Resolves the Anthropic API key: env var first, then the local config file
 * written by the first-run wizard (chmod 600 there — see config/config.ts).
 * Never logs the key; callers must not print the return value either.
 * `path` defaults to CONFIG_PATH and exists as a seam for tests.
 */
export function resolveApiKey(path: string = CONFIG_PATH): string | undefined {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const key = readConfig(path).apiKey;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}
