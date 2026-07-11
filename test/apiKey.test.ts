import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveApiKey } from '../src/config/apiKey.js';
import { writeConfig } from '../src/config/config.js';

const ENV_KEY = 'ANTHROPIC_API_KEY';
let originalEnv: string | undefined;
let dir: string;

beforeEach(() => {
  originalEnv = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  dir = mkdtempSync(join(tmpdir(), 'nocap-apikey-test-'));
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalEnv;
  rmSync(dir, { recursive: true, force: true });
});

describe('resolveApiKey', () => {
  it('prefers the env var when set', () => {
    process.env[ENV_KEY] = 'sk-ant-from-env';
    const path = join(dir, 'config.json');
    writeConfig({ apiKey: 'sk-ant-from-config' }, path);
    expect(resolveApiKey(path)).toBe('sk-ant-from-env');
  });

  it('falls back to the config file when env is unset', () => {
    const path = join(dir, 'config.json');
    writeConfig({ apiKey: 'sk-ant-from-config' }, path);
    expect(resolveApiKey(path)).toBe('sk-ant-from-config');
  });

  it('returns undefined when neither env nor config has a key', () => {
    expect(resolveApiKey(join(dir, 'missing.json'))).toBeUndefined();
  });
});
