import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfig, writeConfig } from '../src/config/config.js';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nocap-config-test-'));
  path = join(dir, 'nested', 'config.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readConfig', () => {
  it('returns {} when the file does not exist yet', () => {
    expect(readConfig(path)).toEqual({});
  });

  it('returns {} on malformed JSON rather than throwing', () => {
    mkdirSync(join(dir, 'nested'), { recursive: true }); // ensure parent exists for the raw write below
    writeFileSync(path, '{not valid json', 'utf8');
    expect(readConfig(path)).toEqual({});
  });

  it('round-trips a config written by writeConfig', () => {
    writeConfig({ apiKey: 'sk-ant-test123', model: 'claude-sonnet-5' }, path);
    expect(readConfig(path)).toEqual({ apiKey: 'sk-ant-test123', model: 'claude-sonnet-5' });
  });
});

describe('writeConfig', () => {
  it('creates parent directories as needed', () => {
    writeConfig({ apiKey: 'x' }, path);
    expect(readConfig(path)).toEqual({ apiKey: 'x' });
  });

  it('chmods the file 600, including when overwriting a pre-existing file', () => {
    writeConfig({ apiKey: 'first' }, path);
    writeConfig({ apiKey: 'second' }, path); // overwrite path — writeFileSync's mode option alone won't reapply here
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(readConfig(path)).toEqual({ apiKey: 'second' });
  });
});
