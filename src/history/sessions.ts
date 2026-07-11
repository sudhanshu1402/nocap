import { getSessionInfo as sdkGetSessionInfo, getSessionMessages as sdkGetSessionMessages, listSessions as sdkListSessions } from '@anthropic-ai/claude-agent-sdk';
import type { SDKSessionInfo, SessionMessage } from '../sdk/types.js';

export interface ListRecentSessionsOptions {
  cwd?: string;
  limit?: number;
  /** Injectable for tests — defaults to the real SDK's listSessions(). */
  listSessionsFn?: typeof sdkListSessions;
}

/**
 * Sessions for this project, most-recently-modified first — the natural
 * order for a Ctrl+H history picker. listSessions() itself doesn't document
 * a guaranteed order, so this sorts defensively rather than trusting it.
 */
export async function listRecentSessions(options: ListRecentSessionsOptions = {}): Promise<SDKSessionInfo[]> {
  const list = options.listSessionsFn ?? sdkListSessions;
  const sessions = await list({ dir: options.cwd ?? process.cwd(), limit: options.limit ?? 20 });
  return [...sessions].sort((a, b) => b.lastModified - a.lastModified);
}

export interface GetSessionInfoOptions {
  cwd?: string;
  getSessionInfoFn?: typeof sdkGetSessionInfo;
}

export async function getSessionInfo(sessionId: string, options: GetSessionInfoOptions = {}): Promise<SDKSessionInfo | undefined> {
  const get = options.getSessionInfoFn ?? sdkGetSessionInfo;
  return get(sessionId, { dir: options.cwd });
}

export interface GetSessionMessagesOptions {
  cwd?: string;
  limit?: number;
  getSessionMessagesFn?: typeof sdkGetSessionMessages;
}

export async function getSessionMessages(sessionId: string, options: GetSessionMessagesOptions = {}): Promise<SessionMessage[]> {
  const get = options.getSessionMessagesFn ?? sdkGetSessionMessages;
  return get(sessionId, { dir: options.cwd, limit: options.limit });
}
