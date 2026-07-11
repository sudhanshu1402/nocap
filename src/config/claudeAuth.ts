import { execFileSync } from 'node:child_process';

type ExecFn = (file: string, args: string[]) => string;

const defaultExec: ExecFn = (file, args) =>
  execFileSync(file, args, { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).toString();

/**
 * True when `claude` CLI already has a valid login (subscription or its own
 * stored API key) — checked via its own `auth status` so nocap never demands
 * a redundant key on a machine that's already authenticated. The Agent SDK
 * picks up that same auth automatically once nocap stops forcing
 * ANTHROPIC_API_KEY (see sdk/options.ts). Fails closed: claude not
 * installed, not logged in, or unparseable output all read as false.
 */
export function hasClaudeCliAuth(exec: ExecFn = defaultExec): boolean {
  try {
    return JSON.parse(exec('claude', ['auth', 'status', '--json'])).loggedIn === true;
  } catch {
    return false;
  }
}
