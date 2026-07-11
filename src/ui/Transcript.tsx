import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';
import type { ChatEntry } from './types.js';

interface Props {
  entries: ChatEntry[];
  streamingText: string;
  maxVisible: number;
  scrollOffset: number; // 0 = pinned to bottom (latest)
}

const ROLE_LABEL: Record<ChatEntry['role'], string> = {
  user: 'you',
  assistant: 'claude',
  system: '·',
};

export function Transcript({ entries, streamingText, maxVisible, scrollOffset }: Props): React.JSX.Element {
  const all: ChatEntry[] = streamingText
    ? [...entries, { id: '__streaming__', role: 'assistant', text: streamingText }]
    : entries;

  const end = Math.max(0, all.length - scrollOffset);
  const start = Math.max(0, end - maxVisible);
  const visible = all.slice(start, end);
  const hiddenAbove = start;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {hiddenAbove > 0 && (
        <Text color={colors.dim} dimColor>
          ↑ {hiddenAbove} earlier message{hiddenAbove === 1 ? '' : 's'} — PgUp to scroll
        </Text>
      )}
      {visible.length === 0 && (
        <Text color={colors.dim} dimColor>
          Type a message to get started.
        </Text>
      )}
      {visible.map((entry) => (
        <Box key={entry.id} marginBottom={1} flexDirection="column">
          <Text color={colors.role[entry.role]} bold={entry.role !== 'system'}>
            {ROLE_LABEL[entry.role]}
          </Text>
          <Text>{entry.text || (entry.role === 'assistant' ? '…' : '')}</Text>
        </Box>
      ))}
    </Box>
  );
}
