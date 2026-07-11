import type {
  AgentDefinition,
  CanUseTool,
  McpServerConfig,
  Options,
  PermissionMode,
  PermissionResult,
  PermissionUpdate,
  Query,
  RewindFilesResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKSessionInfo,
  SDKSystemMessage,
  SDKUserMessage,
  SessionMessage,
} from '@anthropic-ai/claude-agent-sdk';

export type {
  AgentDefinition,
  CanUseTool,
  McpServerConfig,
  Options,
  PermissionMode,
  PermissionResult,
  PermissionUpdate,
  Query,
  RewindFilesResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKSessionInfo,
  SDKSystemMessage,
  SDKUserMessage,
  SessionMessage,
};

// query() itself, isolated so session.ts can accept it as an injectable dependency.
export type QueryFn = (params: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}) => Query;

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export function isTextBlock(block: { type: string }): block is TextBlock {
  return block.type === 'text';
}

export function isToolUseBlock(block: { type: string }): block is ToolUseBlock {
  return block.type === 'tool_use';
}
