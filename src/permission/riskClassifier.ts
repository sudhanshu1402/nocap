export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAssessment {
  level: RiskLevel;
  reason: string;
  saferAlternative?: string;
}

interface BashRule {
  pattern: RegExp;
  level: RiskLevel;
  reason: string;
  saferAlternative?: string;
}

// Highest matching level wins, not first match. `sudo npm publish` matches both
// the medium sudo rule and the high publish rule, and first-match ordering gave
// the more dangerous command the softer card. Within one level, first wins, so
// the order below is still most-dangerous-first for readability.
const BASH_RULES: BashRule[] = [
  {
    // Lookaheads so recursive (-r) and force (-f) are caught whether combined
    // in one token (-rf) or passed as separate flags (-r -f, -f -r). Flags
    // must start at a token boundary (so "-router" inside a filename like
    // user-router.ts doesn't count) and can't cross a newline into another
    // statement.
    pattern: /\brm\b(?=[^|;&\n]*(?:^|\s)-[a-z-]*r)(?=[^|;&\n]*(?:^|\s)-[a-z-]*f)/i,
    level: 'high',
    reason: 'deletes files permanently — this cannot be undone',
    saferAlternative: 'move the files to trash instead?',
  },
  {
    pattern: /\bgit\s+push\b[^|;&]*(--force|-f\b)/,
    level: 'high',
    reason: 'force-pushes and can overwrite history on the remote',
  },
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    level: 'high',
    reason: 'discards uncommitted changes permanently',
  },
  {
    // [^|;&\n]* lets the force flag be a separate token (git clean -d -f)
    // without crossing into another newline-joined statement; (?:^|\s)
    // anchors the flag to a token boundary so a pathspec like config-file.txt
    // can't supply a fake "-f".
    pattern: /\bgit\s+clean\b[^|;&\n]*(?:^|\s)-[a-z-]*f/i,
    level: 'high',
    reason: 'deletes untracked files permanently',
  },
  {
    pattern: /\bdrop\s+(table|database)\b/i,
    level: 'high',
    reason: 'permanently deletes data in a database',
  },
  {
    pattern: /\bmkfs\b|\bdd\s+if=|>\s*\/dev\/(sd|nvme|disk)/i,
    level: 'high',
    reason: 'can destroy data on a disk',
  },
  {
    pattern: /\bnpm\s+publish\b|\byarn\s+publish\b|\bpnpm\s+publish\b/,
    level: 'high',
    reason: 'publishes a package publicly — hard to fully undo',
  },
  {
    pattern: /\bcurl\b.*\|\s*(sh|bash)\b|\bwget\b.*\|\s*(sh|bash)\b/,
    level: 'high',
    reason: 'downloads and runs a script from the internet',
  },
  {
    pattern: /\brm\b/,
    level: 'medium',
    reason: 'deletes one or more files',
  },
  {
    pattern: /\bgit\s+push\b/,
    level: 'medium',
    reason: 'uploads local commits to a remote repository',
  },
  {
    pattern: /\bsudo\b/,
    level: 'medium',
    reason: 'runs with elevated system privileges',
  },
];

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function classifyBash(command: string): RiskAssessment {
  let worst: BashRule | undefined;
  for (const rule of BASH_RULES) {
    if (!rule.pattern.test(command)) continue;
    if (!worst || LEVEL_RANK[rule.level] > LEVEL_RANK[worst.level]) worst = rule;
  }
  if (!worst) return { level: 'medium', reason: 'runs a command on your computer' };
  return { level: worst.level, reason: worst.reason, saferAlternative: worst.saferAlternative };
}

const TOOL_RISK: Record<string, RiskAssessment> = {
  Read: { level: 'low', reason: 'only reads a file' },
  Glob: { level: 'low', reason: 'only lists files' },
  Grep: { level: 'low', reason: 'only searches file contents' },
  LS: { level: 'low', reason: 'only lists a folder' },
  NotebookRead: { level: 'low', reason: 'only reads a notebook' },
  WebSearch: { level: 'low', reason: 'only searches the web' },
  WebFetch: { level: 'low', reason: 'only reads a web page' },
  TodoWrite: { level: 'low', reason: 'only updates the in-app task list' },
  Write: { level: 'medium', reason: 'creates or overwrites a file' },
  Edit: { level: 'medium', reason: 'changes the contents of a file' },
  MultiEdit: { level: 'medium', reason: 'changes the contents of a file' },
  NotebookEdit: { level: 'medium', reason: 'changes a notebook cell' },
};

export function classifyRisk(toolName: string, input: Record<string, unknown>): RiskAssessment {
  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : '';
    return classifyBash(command);
  }
  if (toolName.startsWith('mcp__')) {
    return { level: 'medium', reason: 'performs an action via a connected tool' };
  }
  return TOOL_RISK[toolName] ?? { level: 'medium', reason: 'performs an action Claude requested' };
}
