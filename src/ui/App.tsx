import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useInput } from 'ink';
import { SdkSession } from '../sdk/session.js';
import { buildOptions } from '../sdk/options.js';
import { isTextBlock, isToolUseBlock } from '../sdk/types.js';
import type { PermissionMode, QueryFn, SDKMessage } from '../sdk/types.js';
import { ApprovalMachine, type ApprovalRequest } from '../permission/approvalMachine.js';
import { createCanUseTool } from '../permission/canUseTool.js';
import { narrate, type InsightLine } from '../narrator/narrate.js';
import { estimateCost, type TokenUsage } from '../cost/costMeter.js';
import { CheckpointTracker, restoreGitSnapshot } from '../checkpoint/checkpoints.js';
import { getSessionMessages, listRecentSessions } from '../history/sessions.js';
import { redact } from '../util/redact.js';
import { isSlashCommand, pluralize } from '../util/format.js';
import { Layout } from './Layout.js';
import { ApprovalCard } from './ApprovalCard.js';
import { HistoryBrowser } from './HistoryBrowser.js';
import { PromptInput } from './PromptInput.js';
import type { ChatEntry, SessionStatus } from './types.js';
import type { SDKSessionInfo, SessionMessage } from '../sdk/types.js';

const SCROLL_STEP = 8;

function textFromStoredMessage(message: unknown): string {
  const content = (message as { content?: unknown } | null)?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let text = '';
  for (const block of content) {
    if (block && typeof block === 'object' && 'type' in block && isTextBlock(block as { type: string })) {
      text += (block as { text: string }).text;
    }
  }
  return text;
}

// Session-store messages are persisted with `message: unknown` (sdk/types.ts
// — the on-disk shape isn't guaranteed) — extract just enough text to
// repaint the transcript after a resume.
function sessionMessagesToEntries(messages: SessionMessage[]): ChatEntry[] {
  const entries: ChatEntry[] = [];
  for (const msg of messages) {
    if (msg.type !== 'user' && msg.type !== 'assistant') continue;
    const text = textFromStoredMessage(msg.message);
    if (!text) continue;
    entries.push({ id: msg.uuid, role: msg.type, text: msg.type === 'assistant' ? redact(text) : text });
  }
  return entries;
}

type SetEntries = React.Dispatch<React.SetStateAction<ChatEntry[]>>;

// Shared by the launch-time resume effect and Ctrl+H's handleResumeSession —
// `isStale` lets a caller abandon its own result once a newer resume has
// superseded it (see resumeGenerationRef in App).
async function loadPastTranscript(sessionId: string, cwd: string, setEntries: SetEntries, isStale: () => boolean): Promise<void> {
  try {
    const messages = await getSessionMessages(sessionId, { cwd });
    if (isStale()) return;
    const restored = sessionMessagesToEntries(messages);
    if (restored.length > 0) {
      setEntries((prev) => [...prev, ...restored]);
    }
  } catch (err) {
    if (isStale()) return;
    setEntries((prev) => [
      ...prev,
      { id: `resume-error-${sessionId}`, role: 'system', text: `⚠ couldn't load past transcript: ${redact(err instanceof Error ? err.message : String(err))}` },
    ]);
  }
}

export interface AppProps {
  apiKey?: string;
  model?: string;
  cwd?: string;
  resumeSessionId?: string; // set by --continue/--resume to resume on launch
  resumeNotice?: string; // e.g. "no past session found" — shown in-transcript since stderr is hidden once the alt-screen takes over
  queryFn?: QueryFn; // injectable for tests — omit to use the real SDK
  onEntriesChange?: (entries: ChatEntry[]) => void;
}

export function App(props: AppProps): React.JSX.Element {
  const { exit } = useApp();

  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [insights, setInsights] = useState<InsightLine[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalRequest[]>([]);
  const [model, setModel] = useState(props.model ?? 'connecting…');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [tick, setTick] = useState(0);
  const [sessionCostUsd, setSessionCostUsd] = useState<number | undefined>(undefined);
  const [turnUsage, setTurnUsage] = useState<Partial<TokenUsage>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SDKSessionInfo[]>([]);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const startedAtRef = useRef(0);
  const msgCounterRef = useRef(0);
  const checkpointTurnRef = useRef(0);
  const checkpointsRef = useRef(new CheckpointTracker());
  const gitSnapshotRef = useRef<Array<{ hash: string; createdAt: number }>>([]);
  const resumeIdRef = useRef<string | undefined>(props.resumeSessionId);
  // Bumped by both the launch-time resume effect and handleResumeSession —
  // whichever load started last wins; an earlier in-flight load checks this
  // before applying its result and discards itself if it's been superseded.
  const resumeGenerationRef = useRef(0);

  const approvalMachine = useMemo(() => new ApprovalMachine(), []);
  // sessionEpoch is bumped by handleResumeSession to force a fresh SdkSession
  // (the lifecycle effect below re-runs whenever `session`'s identity changes).
  const session = useMemo(() => new SdkSession(props.queryFn), [props.queryFn, sessionEpoch]);
  const cwd = props.cwd ?? process.cwd();

  useEffect(() => {
    props.onEntriesChange?.(entries);
  }, [entries, props]);

  // Elapsed-time clock, ticks independently of message traffic.
  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => setTick(Date.now() - startedAtRef.current), 1000);
    return () => clearInterval(id);
  }, []);

  // Launched with --continue/--resume: preload the past transcript so the
  // resumed conversation is visible right away, same as picking one from
  // Ctrl+H. Mount-only — resumeSessionId is a launch-time value that never
  // changes for the life of the process. Shares resumeGenerationRef with
  // handleResumeSession so a Ctrl+H resume that lands first wins and this
  // load's result is discarded instead of appending stale/duplicate entries.
  useEffect(() => {
    const sessionId = props.resumeSessionId;
    if (!sessionId) {
      if (props.resumeNotice) {
        setEntries((prev) => [...prev, { id: 'resume-notice', role: 'system', text: props.resumeNotice as string }]);
      }
      return;
    }
    const myGeneration = ++resumeGenerationRef.current;
    setEntries((prev) => [...prev, { id: `resume-${sessionId}`, role: 'system', text: `resuming session ${sessionId.slice(0, 8)}…` }]);
    void loadPastTranscript(sessionId, cwd, setEntries, () => resumeGenerationRef.current !== myGeneration);
  }, []);

  useEffect(() => {
    return approvalMachine.onChange(setApprovalQueue);
  }, [approvalMachine]);

  // Session lifecycle: starts once, lives for the whole app run. All state
  // updates below use the functional-updater form, so this effect never
  // needs to re-run when unrelated state changes.
  useEffect(() => {
    const canUseTool = createCanUseTool(approvalMachine, {
      cwd,
      onBashSnapshot: (_toolUseId, hash) => {
        gitSnapshotRef.current.push({ hash, createdAt: Date.now() });
      },
    });

    const handleMessage = (msg: SDKMessage): void => {
      switch (msg.type) {
        case 'system': {
          if (msg.subtype === 'init') {
            setModel(msg.model);
            setPermissionMode(msg.permissionMode);
          } else if (msg.subtype === 'permission_denied') {
            setEntries((prev) => [
              ...prev,
              { id: `denied-${msg.uuid}`, role: 'system', text: `blocked: ${msg.tool_name} — ${redact(msg.message)}` },
            ]);
          }
          break;
        }
        case 'stream_event': {
          const { event } = msg;
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const chunk = event.delta.text;
            setStreamingText((text) => text + redact(chunk));
          } else if (event.type === 'message_delta') {
            // Cumulative usage-so-far for this turn — feeds the live $ estimate
            // in the status bar until the authoritative result.total_cost_usd lands.
            const { usage } = event;
            setTurnUsage({
              input_tokens: usage.input_tokens ?? 0,
              output_tokens: usage.output_tokens,
              cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
              cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
            });
          }
          break;
        }
        case 'assistant': {
          let text = '';
          for (const block of msg.message.content) {
            if (isTextBlock(block)) {
              text += block.text;
            } else if (isToolUseBlock(block)) {
              const line = narrate(block.id, block.name, block.input);
              setInsights((prev) => [...prev, line]);
            }
          }
          if (text) {
            setEntries((prev) => [...prev, { id: msg.uuid, role: 'assistant', text: redact(text) }]);
          }
          setStreamingText('');
          break;
        }
        case 'result': {
          setStatus(msg.is_error ? 'error' : 'idle');
          // total_cost_usd is already the session-to-date total, not a
          // per-turn delta — replace, never sum, and clear the in-turn
          // estimate now that the real number has landed.
          setSessionCostUsd(msg.total_cost_usd);
          setTurnUsage({});
          if (msg.is_error) {
            const detail = msg.subtype === 'success' ? 'the turn ended in an error' : (msg.errors[0] ?? msg.subtype);
            setEntries((prev) => [...prev, { id: `result-${msg.uuid}`, role: 'system', text: `⚠ ${redact(detail)}` }]);
          }
          break;
        }
        case 'user': {
          // isReplay (not just uuid) distinguishes a genuine turn replay —
          // from extraArgs' 'replay-user-messages' — from other 'user' messages.
          if ('isReplay' in msg) {
            checkpointTurnRef.current += 1;
            checkpointsRef.current.record(msg.uuid, `turn ${checkpointTurnRef.current}`);
          }
          break;
        }
        default:
          break; // other system subtypes are ignored in Phase 1
      }
    };

    const handleError = (err: unknown): void => {
      setStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setEntries((prev) => [...prev, { id: `error-${prev.length}`, role: 'system', text: `⚠ ${redact(message)}` }]);
    };

    const unsubMessage = session.onMessage(handleMessage);
    const unsubError = session.onError(handleError);
    session.start(
      buildOptions({
        apiKey: props.apiKey,
        model: props.model,
        cwd: props.cwd,
        canUseTool,
        permissionMode: 'default',
        resume: resumeIdRef.current,
      }),
    );

    return () => {
      unsubMessage();
      unsubError();
      session.close();
    };
    // Deliberately excludes props.apiKey/model/cwd/approvalMachine: the
    // session restarts only when `session` itself changes identity — either
    // once at mount, or when handleResumeSession bumps sessionEpoch.
  }, [session]);

  // Ctrl+Z: primarily rewinds Write/Edit/NotebookEdit changes via the SDK's
  // native per-turn checkpoint; falls back to the last git safety snapshot
  // (see checkpoint/checkpoints.ts) only when there's no SDK checkpoint left
  // to step back to — e.g. a turn that only ran Bash.
  const handleUndo = async (): Promise<void> => {
    const target = checkpointsRef.current.undoTarget();
    let rewindError: string | undefined;
    if (target) {
      const result = await session.rewindFiles(target.id);
      if (result?.canRewind) {
        checkpointsRef.current.confirmUndo();
        const filesChanged = result.filesChanged?.length ?? 0;
        setEntries((prev) => [
          ...prev,
          {
            id: `undo-${target.id}`,
            role: 'system',
            text: `undone: ${target.label} — ${pluralize(filesChanged, 'file')} restored (+${result.insertions ?? 0}/-${result.deletions ?? 0})`,
          },
        ]);
        return;
      }
      // SDK rewind had nothing to do (e.g. a Bash-only turn) — fall through
      // to the git snapshot fallback instead of stopping here.
      rewindError = result?.error ?? 'nothing to rewind';
    }
    const snapshot = gitSnapshotRef.current.at(-1);
    if (snapshot) {
      const restored = await restoreGitSnapshot(cwd, snapshot.hash);
      if (restored) {
        // Only consume the snapshot once it's actually been applied — a
        // failed restore leaves it in place so a retry has something to undo.
        gitSnapshotRef.current = gitSnapshotRef.current.slice(0, -1);
      }
      setEntries((prev) => [
        ...prev,
        {
          id: `undo-git-${snapshot.hash}`,
          role: 'system',
          text: restored ? "undone: restored files from the last risky command's safety snapshot" : "couldn't restore the last safety snapshot",
        },
      ]);
      return;
    }
    setEntries((prev) => [
      ...prev,
      { id: `undo-none-${prev.length}`, role: 'system', text: rewindError ? `couldn't undo: ${rewindError}` : 'nothing to undo yet' },
    ]);
  };

  const current = approvalQueue[0];

  // Ctrl+H: browse past sessions for this cwd and resume one. Blocked while
  // an approval is pending so the history picker never hides a live prompt.
  const openHistory = async (): Promise<void> => {
    const list = await listRecentSessions({ cwd });
    setSessions(list);
    setHistoryOpen(true);
  };

  const handleResumeSession = async (sessionId: string): Promise<void> => {
    resumeIdRef.current = sessionId;
    checkpointsRef.current = new CheckpointTracker();
    checkpointTurnRef.current = 0;
    gitSnapshotRef.current = [];
    setHistoryOpen(false);
    setStreamingText('');
    setInsights([]);
    setSessionCostUsd(undefined);
    setTurnUsage({});
    setStatus('idle');
    setEntries([{ id: `resume-${sessionId}`, role: 'system', text: `resuming session ${sessionId.slice(0, 8)}…` }]);
    // Swap in a fresh SdkSession (via the useMemo above) before the await
    // below, not after — otherwise the old session stays fully subscribed
    // for the whole transcript-load duration, and any message it receives
    // in that window lands on the freshly-reset state above.
    setSessionEpoch((epoch) => epoch + 1);
    const myGeneration = ++resumeGenerationRef.current;
    await loadPastTranscript(sessionId, cwd, setEntries, () => resumeGenerationRef.current !== myGeneration);
  };

  // Reports a rejection into the transcript instead of letting it become an
  // unhandled rejection, which would otherwise crash the whole TUI (Node's
  // default unhandledRejection behavior is to throw).
  const runFireAndForget = (fn: () => Promise<unknown> | undefined): void => {
    fn()?.catch((err: unknown) => {
      setEntries((prev) => [
        ...prev,
        { id: `error-${prev.length}`, role: 'system', text: `⚠ ${redact(err instanceof Error ? err.message : String(err))}` },
      ]);
    });
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      session.close();
      exit();
      return;
    }
    if (key.ctrl && input === 'z') {
      runFireAndForget(handleUndo);
      return;
    }
    if (key.ctrl && input === 'h' && !current) {
      runFireAndForget(openHistory);
      return;
    }
    if (key.escape) {
      if (historyOpen) {
        setHistoryOpen(false);
        return;
      }
      if (status === 'running') {
        runFireAndForget(() => session.interrupt());
        setStatus('idle');
      }
      return;
    }
    if (key.pageUp) {
      setScrollOffset((offset) => Math.min(Math.max(0, entries.length - 1), offset + SCROLL_STEP));
      return;
    }
    if (key.pageDown) {
      setScrollOffset((offset) => Math.max(0, offset - SCROLL_STEP));
    }
  });

  const handleSubmit = (text: string): void => {
    msgCounterRef.current += 1;
    setEntries((prev) => [...prev, { id: `user-${msgCounterRef.current}`, role: 'user', text }]);
    setScrollOffset(0);
    // Claude Code's slash commands (/mcp, /agents, /hooks, etc.) are handled
    // by the real CLI's own REPL before a message is ever sent — nocap has no
    // equivalent, so forwarding "/foo" would just confuse the model instead
    // of doing anything. Say so plainly instead of sending it silently.
    if (isSlashCommand(text)) {
      setEntries((prev) => [
        ...prev,
        {
          id: `slash-${msgCounterRef.current}`,
          role: 'system',
          text: "slash commands aren't supported in nocap yet — ask in plain English instead, or run `claude` directly for that command.",
        },
      ]);
      return;
    }
    setStatus('running');
    session.send(text);
  };

  // Confirmed session total (from the last result) plus a live local
  // estimate for the turn in flight, if any — replaced wholesale the moment
  // the next result lands. Undefined (no $ shown) until there's anything to show.
  const runningEstimateUsd = status === 'running' ? estimateCost(turnUsage, model) : 0;
  const costUsd = sessionCostUsd !== undefined || runningEstimateUsd > 0 ? (sessionCostUsd ?? 0) + runningEstimateUsd : undefined;

  const bottom = current ? (
    <ApprovalCard
      request={current}
      queuedCount={approvalQueue.length - 1}
      onApprove={(remember) => approvalMachine.approve(current.id, { remember })}
      onDeny={() => approvalMachine.deny(current.id)}
    />
  ) : historyOpen ? (
    <HistoryBrowser sessions={sessions} onSelect={(id) => runFireAndForget(() => handleResumeSession(id))} onClose={() => setHistoryOpen(false)} />
  ) : (
    <PromptInput isActive value={draft} onChange={setDraft} onSubmit={handleSubmit} />
  );

  return (
    <Layout
      entries={entries}
      streamingText={streamingText}
      insights={insights}
      model={model}
      permissionMode={permissionMode}
      elapsedMs={tick}
      costUsd={costUsd}
      status={status}
      scrollOffset={scrollOffset}
      bottom={bottom}
    />
  );
}
