import type { PermissionResult, PermissionUpdate } from '../sdk/types.js';
import type { RiskAssessment } from './riskClassifier.js';

export interface ApprovalRequest {
  id: string; // toolUseID
  toolName: string;
  input: Record<string, unknown>;
  title?: string;
  displayName?: string;
  description?: string;
  suggestions?: PermissionUpdate[];
  risk: RiskAssessment;
  createdAt: number;
}

type Settle = (result: PermissionResult) => void;
type QueueListener = (queue: ApprovalRequest[]) => void;

/**
 * Approval-flow state machine: idle (empty queue) -> pending (queued request)
 * -> approved/denied (resolves the canUseTool promise, removes from queue).
 * Concurrent tool calls each get their own queued request; the UI renders
 * `current` (the head) and decides one at a time.
 */
export class ApprovalMachine {
  private queue: ApprovalRequest[] = [];
  private settlers = new Map<string, Settle>();
  private listeners: QueueListener[] = [];

  get current(): ApprovalRequest | undefined {
    return this.queue[0];
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  onChange(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  request(req: ApprovalRequest, signal?: AbortSignal): Promise<PermissionResult> {
    return new Promise((resolve) => {
      const settle: Settle = (result) => {
        if (!this.settlers.has(req.id)) return; // already settled
        this.settlers.delete(req.id);
        this.queue = this.queue.filter((r) => r.id !== req.id);
        this.emit();
        resolve(result);
      };
      this.settlers.set(req.id, settle);
      this.queue.push(req);
      this.emit();

      if (signal) {
        if (signal.aborted) {
          settle({ behavior: 'deny', message: 'cancelled — turn was interrupted' });
          return;
        }
        signal.addEventListener(
          'abort',
          () => settle({ behavior: 'deny', message: 'cancelled — turn was interrupted' }),
          { once: true },
        );
      }
    });
  }

  approve(id: string, options?: { remember?: boolean }): void {
    const req = this.queue.find((r) => r.id === id);
    const settle = this.settlers.get(id);
    if (!settle || !req) return;
    settle({
      behavior: 'allow',
      updatedInput: req.input,
      updatedPermissions: options?.remember ? req.suggestions : undefined,
    });
  }

  deny(id: string, message = 'denied by user'): void {
    const settle = this.settlers.get(id);
    if (!settle) return;
    settle({ behavior: 'deny', message });
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.queue);
  }
}
