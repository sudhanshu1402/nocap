import { truncate } from '../util/format.js';

const SUMMARY_FIELDS = ['file_path', 'path', 'command', 'query', 'url', 'pattern', 'prompt', 'notebook_path'];

function humanizeWords(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
}

function humanizeToolName(toolName: string): string {
  if (toolName.startsWith('mcp__')) {
    const [, server, ...rest] = toolName.split('__');
    const action = rest.join('_');
    return action ? `${humanizeWords(action)} via ${server ?? 'a connected tool'}` : `using ${server ?? 'a connected tool'}`;
  }
  return humanizeWords(toolName);
}

function pickSummaryField(input: Record<string, unknown>): string | undefined {
  for (const field of SUMMARY_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' && value.length > 0) return truncate(value, 50);
  }
  return undefined;
}

/**
 * Local heuristic used when no template matches a tool (unknown built-in or
 * an mcp__* call we haven't special-cased). Still zero-token: string
 * manipulation only, no LLM call.
 */
export function fallbackLine(toolName: string, input: Record<string, unknown>): string {
  const base = humanizeToolName(toolName);
  const summary = pickSummaryField(input);
  return summary ? `${base} (${summary})` : base;
}
