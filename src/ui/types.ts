export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export type SessionStatus = 'idle' | 'running' | 'error';
