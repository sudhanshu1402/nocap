import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const CONFIG_PATH = join(homedir(), '.nocap', 'config.json');

export interface NocapConfig {
  apiKey?: string;
  model?: string;
  telemetryOptIn?: boolean;
}

/** Returns {} on any read/parse failure — no config file yet is the normal first-run case. */
export function readConfig(path: string = CONFIG_PATH): NocapConfig {
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as NocapConfig) : {};
  } catch {
    return {};
  }
}

/**
 * Writes the config file chmod 600 — it may hold an API key. writeFileSync's
 * `mode` option only applies when the file is newly created, so an explicit
 * chmodSync afterward guarantees the permission even when overwriting a file
 * that already existed with looser permissions.
 */
export function writeConfig(config: NocapConfig, path: string = CONFIG_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
}
