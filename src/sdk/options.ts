import type { CanUseTool, Options, PermissionMode } from './types.js';

/**
 * Tools that never touch the filesystem/network destructively — auto-allowed
 * so approval cards only appear for genuinely consequential actions. Never
 * put a write/execute/delete-capable tool in this list.
 */
export const READ_ONLY_AUTO_ALLOW = [
  'Read',
  'Glob',
  'Grep',
  'LS',
  'NotebookRead',
  'WebSearch',
  'WebFetch',
  'TodoWrite',
] as const;

const READ_ONLY_AUTO_ALLOW_SET = new Set<string>(READ_ONLY_AUTO_ALLOW);

export function isAutoAllowedReadOnly(toolName: string): boolean {
  return READ_ONLY_AUTO_ALLOW_SET.has(toolName);
}

export interface SessionConfig {
  apiKey: string;
  model?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  canUseTool: CanUseTool;
  resume?: string;
  onStderr?: (data: string) => void;
}

export function buildOptions(config: SessionConfig): Options {
  return {
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    tools: { type: 'preset', preset: 'claude_code' },
    // Loads the user's real hooks, MCP servers, skills, and CLAUDE.md — this
    // is a UI layer over real Claude Code, never a sandboxed subset.
    settingSources: ['user', 'project', 'local'],
    permissionMode: config.permissionMode ?? 'default',
    model: config.model,
    canUseTool: config.canUseTool,
    includePartialMessages: true,
    enableFileCheckpointing: true,
    extraArgs: { 'replay-user-messages': null },
    cwd: config.cwd ?? process.cwd(),
    resume: config.resume,
    // `env` REPLACES process.env wholesale (per SDK docs) — spread it or the
    // subprocess loses PATH/HOME/nvm-managed node and silently misbehaves.
    env: { ...process.env, ANTHROPIC_API_KEY: config.apiKey },
    stderr: config.onStderr,
  };
}
