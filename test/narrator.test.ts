import { describe, expect, it } from 'vitest';
import { fallbackLine } from '../src/narrator/fallback.js';
import { narrate } from '../src/narrator/narrate.js';
import { lookupTemplate } from '../src/narrator/templates.js';

describe('narrator templates', () => {
  it('narrates Read with a shortened path', () => {
    const line = lookupTemplate('Read')?.({ file_path: `${process.cwd()}/src/index.ts` });
    expect(line).toBe('reading src/index.ts');
  });

  it('narrates Write with a shortened path', () => {
    const line = lookupTemplate('Write')?.({ file_path: `${process.cwd()}/notes.md` });
    expect(line).toBe('writing notes.md');
  });

  it('narrates Edit', () => {
    const line = lookupTemplate('Edit')?.({ file_path: `${process.cwd()}/src/a.ts` });
    expect(line).toBe('editing src/a.ts');
  });

  it('narrates MultiEdit with a change count', () => {
    const line = lookupTemplate('MultiEdit')?.({
      file_path: `${process.cwd()}/src/a.ts`,
      edits: [{}, {}, {}],
    });
    expect(line).toBe('making 3 changes to src/a.ts');
  });

  it('narrates Bash using the description when present', () => {
    const line = lookupTemplate('Bash')?.({ command: 'npm test', description: 'running the test suite' });
    expect(line).toBe('running the test suite');
  });

  it('narrates Bash by truncating the raw command when no description is given', () => {
    const line = lookupTemplate('Bash')?.({ command: 'echo hi' });
    expect(line).toBe('running: echo hi');
  });

  it('narrates Grep with and without a path', () => {
    expect(lookupTemplate('Grep')?.({ pattern: 'TODO' })).toBe('searching for "TODO"');
    expect(lookupTemplate('Grep')?.({ pattern: 'TODO', path: `${process.cwd()}/src` })).toBe(
      'searching for "TODO" in src',
    );
  });

  it('narrates Glob', () => {
    expect(lookupTemplate('Glob')?.({ pattern: '**/*.ts' })).toBe('finding files matching "**/*.ts"');
  });

  it('narrates LS, defaulting to "." when no path is given', () => {
    expect(lookupTemplate('LS')?.({})).toBe('listing .');
  });

  it('narrates WebSearch and WebFetch', () => {
    expect(lookupTemplate('WebSearch')?.({ query: 'ink 7 changelog' })).toBe(
      'searching the web for "ink 7 changelog"',
    );
    expect(lookupTemplate('WebFetch')?.({ url: 'https://example.com' })).toBe(
      'reading the page at https://example.com',
    );
  });

  it('narrates Task with and without a description', () => {
    expect(lookupTemplate('Task')?.({ subagent_type: 'general-purpose', description: 'find the bug' })).toBe(
      'delegating to general-purpose: find the bug',
    );
    expect(lookupTemplate('Task')?.({})).toBe('delegating to a subagent');
  });

  it('narrates TodoWrite with an item count', () => {
    expect(lookupTemplate('TodoWrite')?.({ todos: [{}, {}] })).toBe('updating the task list (2 items)');
  });

  it('narrates NotebookRead and NotebookEdit', () => {
    expect(lookupTemplate('NotebookRead')?.({ notebook_path: `${process.cwd()}/nb.ipynb` })).toBe(
      'reading notebook nb.ipynb',
    );
    expect(lookupTemplate('NotebookEdit')?.({ notebook_path: `${process.cwd()}/nb.ipynb` })).toBe(
      'editing a cell in nb.ipynb',
    );
  });

  it('has no template for unknown tools', () => {
    expect(lookupTemplate('SomeRandomTool')).toBeUndefined();
  });
});

describe('fallbackLine', () => {
  it('humanizes an unknown built-in tool name', () => {
    expect(fallbackLine('SomeFutureTool', {})).toBe('some future tool');
  });

  it('appends a summary field when one is present', () => {
    expect(fallbackLine('SomeFutureTool', { command: 'do a thing' })).toBe('some future tool (do a thing)');
  });

  it('humanizes an mcp__ tool as "<action> via <server>"', () => {
    expect(fallbackLine('mcp__github__create_pr', {})).toBe('create pr via github');
  });

  it('falls back to "using <server>" when an mcp__ tool has no action segment', () => {
    expect(fallbackLine('mcp__github', {})).toBe('using github');
  });
});

describe('narrate', () => {
  it('produces an InsightLine with the tool-use id, text, and risk level', () => {
    const line = narrate('toolu_1', 'Read', { file_path: `${process.cwd()}/src/index.ts` });
    expect(line).toEqual({ id: 'toolu_1', toolName: 'Read', text: 'reading src/index.ts', risk: 'low' });
  });

  it('falls back to the heuristic for a tool with no template', () => {
    const line = narrate('toolu_2', 'mcp__jira__create_ticket', { prompt: 'file a bug' });
    expect(line.text).toBe('create ticket via jira (file a bug)');
    expect(line.risk).toBe('medium');
  });

  it('carries a high risk level through for a destructive Bash command', () => {
    const line = narrate('toolu_3', 'Bash', { command: 'rm -rf ./dist' });
    expect(line.risk).toBe('high');
    expect(line.text).toBe('running: rm -rf ./dist');
  });
});
