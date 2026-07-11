import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './theme.js';
import { truncate } from '../util/format.js';
import type { SDKSessionInfo } from '../sdk/types.js';

interface Props {
  sessions: SDKSessionInfo[];
  onSelect: (sessionId: string) => void;
  onClose: () => void;
}

export function relativeTime(ms: number): string {
  const deltaS = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (deltaS < 60) return 'just now';
  const deltaM = Math.round(deltaS / 60);
  if (deltaM < 60) return `${deltaM}m ago`;
  const deltaH = Math.round(deltaM / 60);
  if (deltaH < 24) return `${deltaH}h ago`;
  return `${Math.round(deltaH / 24)}d ago`;
}

/**
 * Ctrl+H session picker. Owns up/down/Enter/Esc while mounted, same pattern
 * as ApprovalCard — the parent conditionally mounts this in place of the
 * PromptInput, so it's the only thing capturing input.
 */
export function HistoryBrowser({ sessions, onSelect, onClose }: Props): React.JSX.Element {
  const [index, setIndex] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setIndex((i) => Math.min(sessions.length - 1, i + 1));
    } else if (key.return && sessions[index]) {
      onSelect(sessions[index].sessionId);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.border} paddingX={1}>
      <Text bold>resume a past session (↑↓ select · enter resume · esc cancel)</Text>
      {sessions.length === 0 && (
        <Text color={colors.dim} dimColor>
          no past sessions found here
        </Text>
      )}
      {sessions.map((session, i) => {
        const title = session.customTitle ?? session.summary ?? session.firstPrompt ?? session.sessionId;
        const selected = i === index;
        return (
          <Text key={session.sessionId} color={selected ? colors.accent : undefined} inverse={selected}>
            {selected ? '› ' : '  '}
            {truncate(title, 70)} — {relativeTime(session.lastModified)}
          </Text>
        );
      })}
    </Box>
  );
}
