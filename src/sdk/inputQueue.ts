import type { SDKUserMessage } from './types.js';

/**
 * A pushable async iterable of SDKUserMessage. Feeding this as `prompt` to
 * query() keeps one continuous streaming-input session alive for the whole
 * app lifetime — full context, hooks, MCP, subagents, permissions intact.
 */
export class InputQueue implements AsyncIterable<SDKUserMessage> {
  private buffered: SDKUserMessage[] = [];
  private waiting: Array<(msg: IteratorResult<SDKUserMessage>) => void> = [];
  private closed = false;

  push(text: string): void {
    if (this.closed) return;
    const message: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
    };
    const waiter = this.waiting.shift();
    if (waiter) {
      waiter({ value: message, done: false });
    } else {
      this.buffered.push(message);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const waiter of this.waiting.splice(0)) {
      waiter({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return {
      next: (): Promise<IteratorResult<SDKUserMessage>> => {
        const next = this.buffered.shift();
        if (next) return Promise.resolve({ value: next, done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiting.push(resolve));
      },
    };
  }
}
