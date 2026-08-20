import { query as liveQuery } from '@anthropic-ai/claude-agent-sdk';
import { InputQueue } from './inputQueue.js';
import type { Options, PermissionMode, Query, QueryFn, SDKMessage } from './types.js';

type MessageListener = (msg: SDKMessage) => void;
type ErrorListener = (err: unknown) => void;

/**
 * Wraps the SDK's streaming-input query() as one long-lived session.
 * queryFn is injectable so tests can pass a scripted mock instead of the
 * real SDK (which needs a network call and an API key).
 */
export class SdkSession {
  private readonly queryFn: QueryFn;
  private readonly inputQueue = new InputQueue();
  private queryHandle: Query | undefined;
  private messageListeners: MessageListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private started = false;

  constructor(queryFn: QueryFn = liveQuery as QueryFn) {
    this.queryFn = queryFn;
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== listener);
    };
  }

  start(options: Options): void {
    if (this.started) throw new Error('SdkSession already started');
    this.started = true;
    this.queryHandle = this.queryFn({ prompt: this.inputQueue, options });
    void this.consume();
  }

  private async consume(): Promise<void> {
    if (!this.queryHandle) return;
    try {
      for await (const msg of this.queryHandle) {
        // A listener that throws must not abandon the iterator — doing that
        // deadens the session with no way back. Report it and keep consuming.
        for (const listener of this.messageListeners) {
          try {
            listener(msg);
          } catch (err) {
            for (const errListener of this.errorListeners) errListener(err);
          }
        }
      }
    } catch (err) {
      for (const listener of this.errorListeners) listener(err);
    }
  }

  send(text: string): void {
    this.inputQueue.push(text);
  }

  interrupt(): Promise<unknown> | undefined {
    return this.queryHandle?.interrupt();
  }

  setPermissionMode(mode: PermissionMode): Promise<void> | undefined {
    return this.queryHandle?.setPermissionMode(mode);
  }

  setModel(model?: string): Promise<void> | undefined {
    return this.queryHandle?.setModel(model);
  }

  rewindFiles(
    userMessageId: string,
  ): ReturnType<Query['rewindFiles']> | undefined {
    return this.queryHandle?.rewindFiles(userMessageId);
  }

  // Signals no further turns are coming without tearing down the in-flight
  // query — unlike close(), the current response is still allowed to arrive.
  endInput(): void {
    this.inputQueue.close();
  }

  close(): void {
    this.inputQueue.close();
    this.queryHandle?.close();
  }
}
