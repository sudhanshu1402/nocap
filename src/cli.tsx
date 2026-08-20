#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { runOnce } from './once.js';
import { resolveApiKey } from './config/apiKey.js';
import { hasClaudeCliAuth } from './config/claudeAuth.js';
import { readConfig, writeConfig } from './config/config.js';
import { listRecentSessions } from './history/sessions.js';
import { Wizard, type WizardResult } from './wizard/setup.js';
import { redact } from './util/redact.js';
import type { ChatEntry } from './ui/types.js';

function printUsage(): void {
  console.error('Usage: nocap [--once "<prompt>"] [--continue|-c] [--resume|-r [id]]');
}

interface ResumeResolution {
  sessionId?: string;
  // Set instead of printing directly — cli.tsx runs console.error too early
  // to be seen once Ink's alternateScreen takes over, so the caller surfaces
  // this in-transcript (App's resumeNotice prop) or, in --once mode, prints
  // it itself where stderr is still visible for the whole run.
  notice?: string;
}

// Mirrors claude's own -c/--continue and -r/--resume [id] so a `claude` ->
// `nocap` alias doesn't silently drop the flag — falls back to the most
// recent session for this folder when no explicit id is given.
async function resolveResumeSessionId(args: string[], cwd: string): Promise<ResumeResolution> {
  const equalsArg = args.find((a) => a.startsWith('--resume=') || a.startsWith('-r='));
  if (equalsArg) {
    const value = equalsArg.slice(equalsArg.indexOf('=') + 1);
    if (value) return { sessionId: value };
  }

  const resumeIndex = args.findIndex((a) => a === '--resume' || a === '-r');
  const continueRequested = args.includes('--continue') || args.includes('-c');
  if (!continueRequested && resumeIndex === -1) return {};

  if (resumeIndex !== -1) {
    const next = args[resumeIndex + 1];
    if (next && !next.startsWith('-')) return { sessionId: next };
  }

  try {
    const [mostRecent] = await listRecentSessions({ cwd, limit: 1 });
    if (!mostRecent) {
      return { notice: 'No past session found in this folder — starting fresh.' };
    }
    return { sessionId: mostRecent.sessionId };
  } catch (err) {
    return { notice: `couldn't read past sessions — starting fresh (${redact(err instanceof Error ? err.message : String(err))})` };
  }
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
      writeConfig({ ...readConfig(), apiKey: result.apiKey, model: result.model });
    }
  }

  const resumeResolution = await resolveResumeSessionId(args, process.cwd());

  if (onceIndex !== -1) {
    const prompt = args[onceIndex + 1];
    if (!prompt || prompt.startsWith('-')) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    if (resumeResolution.notice) {
      console.error(resumeResolution.notice);
    }
    try {
      const result = await runOnce(prompt, { apiKey, model, resume: resumeResolution.sessionId });
      process.exitCode = result.ok ? 0 : 1;
    } catch (err) {
      console.error(redact(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    }
    return;
  }

  let latestEntries: ChatEntry[] = [];
  const instance = render(
    <App
      apiKey={apiKey}
      model={model}
      resumeSessionId={resumeResolution.sessionId}
      resumeNotice={resumeResolution.notice}
      onEntriesChange={(entries) => { latestEntries = entries; }}
    />,
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
