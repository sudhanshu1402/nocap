#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { runOnce } from './once.js';
import { resolveApiKey } from './config/apiKey.js';
import { hasClaudeCliAuth } from './config/claudeAuth.js';
import { readConfig, writeConfig } from './config/config.js';
import { Wizard, type WizardResult } from './wizard/setup.js';
import { redact } from './util/redact.js';
import type { ChatEntry } from './ui/types.js';

function printUsage(): void {
  console.error('Usage: nocap [--once "<prompt>"]');
}

function printTranscript(entries: ChatEntry[]): void {
  if (entries.length === 0) return;
  console.log('\n--- transcript ---');
  for (const entry of entries) {
    const label = entry.role === 'user' ? 'you' : entry.role === 'assistant' ? 'claude' : '·';
    console.log(`\n${label}: ${redact(entry.text)}`);
  }
}

function runWizard(): Promise<WizardResult> {
  return new Promise((resolve) => {
    const instance = render(<Wizard onComplete={(result) => { instance.unmount(); resolve(result); }} />, {
      exitOnCtrlC: true,
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  let apiKey = resolveApiKey();
  let model = readConfig().model;
  const onceIndex = args.indexOf('--once');

  // No explicit key needed when `claude` is already logged in on this
  // machine — the SDK's subprocess picks that auth up on its own as long as
  // we don't force ANTHROPIC_API_KEY (see sdk/options.ts).
  if (!apiKey && !hasClaudeCliAuth()) {
    if (onceIndex !== -1 || !process.stdin.isTTY) {
      console.error('No API key found and no `claude` CLI login detected.');
      console.error('Run `claude` to log in, or set ANTHROPIC_API_KEY, and try again.');
      process.exitCode = 1;
      return;
    }
    const result = await runWizard();
    apiKey = result.apiKey;
    model = result.model;
    if (result.saveLocally) {
      writeConfig({ ...readConfig(), apiKey: result.apiKey, model: result.model, telemetryOptIn: result.telemetryOptIn });
    }
  }

  if (onceIndex !== -1) {
    const prompt = args[onceIndex + 1];
    if (!prompt) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    try {
      const result = await runOnce(prompt, { apiKey, model });
      process.exitCode = result.ok ? 0 : 1;
    } catch (err) {
      console.error(redact(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    }
    return;
  }

  let latestEntries: ChatEntry[] = [];
  const instance = render(
    <App apiKey={apiKey} model={model} onEntriesChange={(entries) => { latestEntries = entries; }} />,
    {
      alternateScreen: true,
      interactive: true,
      exitOnCtrlC: false, // App handles Ctrl+C itself so it can print the transcript on the way out
    },
  );

  await instance.waitUntilExit();
  printTranscript(latestEntries);
}

main().catch((err: unknown) => {
  console.error(redact(err instanceof Error ? (err.stack ?? err.message) : String(err)));
  process.exitCode = 1;
});
