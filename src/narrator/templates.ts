import { pluralize, shortenPath, truncate } from '../util/format.js';
import { redact } from '../util/redact.js';

type Template = (input: Record<string, unknown>) => string;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

// Redact first, then truncate. The other order can cut a secret in half and let
// the tail slip past the pattern — same reasoning as src/ui/ApprovalCard.tsx.
function safe(v: unknown, max: number): string {
  return truncate(redact(str(v)), max);
}

/**
 * Local, zero-token plain-English line per known tool. Every function here
 * must be pure and synchronous — no LLM calls, ever (narration is free).
 */
const TEMPLATES: Record<string, Template> = {
  Read: (input) => `reading ${shortenPath(str(input.file_path))}`,
  Write: (input) => `writing ${shortenPath(str(input.file_path))}`,
  Edit: (input) => `editing ${shortenPath(str(input.file_path))}`,
  MultiEdit: (input) =>
    `making ${pluralize(num(input.edits), 'change')} to ${shortenPath(str(input.file_path))}`,
  Bash: (input) => {
    const description = safe(input.description, 70);
    return description || `running: ${safe(input.command, 70)}`;
  },
  Grep: (input) => {
    const pattern = safe(input.pattern, 40);
    const path = str(input.path);
    return path ? `searching for "${pattern}" in ${shortenPath(path)}` : `searching for "${pattern}"`;
  },
  Glob: (input) => `finding files matching "${safe(input.pattern, 40)}"`,
  LS: (input) => `listing ${shortenPath(str(input.path) || '.')}`,
  WebSearch: (input) => `searching the web for "${safe(input.query, 50)}"`,
  WebFetch: (input) => `reading the page at ${safe(input.url, 60)}`,
  Task: (input) => {
    const agentType = safe(input.subagent_type, 30) || 'a subagent';
    const description = safe(input.description, 50);
    return description ? `delegating to ${agentType}: ${description}` : `delegating to ${agentType}`;
  },
  TodoWrite: (input) => `updating the task list (${pluralize(num(input.todos), 'item')})`,
  NotebookRead: (input) => `reading notebook ${shortenPath(str(input.notebook_path))}`,
  NotebookEdit: (input) => `editing a cell in ${shortenPath(str(input.notebook_path))}`,
};

export function lookupTemplate(toolName: string): Template | undefined {
  return TEMPLATES[toolName];
}
