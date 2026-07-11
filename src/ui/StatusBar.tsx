import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';
import type { PermissionMode } from '../sdk/types.js';
import type { SessionStatus } from './types.js';

interface Props {
  model: string;
  permissionMode: PermissionMode;
  elapsedMs: number;
  costUsd?: number;
  status: SessionStatus;
}

const MODE_LABEL: Record<PermissionMode, string> = {
  default: 'ask before risky actions',
  acceptEdits: 'auto-accept edits',
  bypassPermissions: 'bypass all checks',
  plan: 'planning (read-only)',
  dontAsk: "don't ask (deny unapproved)",
  auto: 'auto-decide (classifier)',
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function StatusBar({ model, permissionMode, elapsedMs, costUsd, status }: Props): React.JSX.Element {
  return (
    <Box borderStyle="single" borderColor={colors.border} paddingX={1} justifyContent="space-between">
      <Text>
        <Text color={colors.accent}>{model}</Text>
        {'  ·  '}
        {MODE_LABEL[permissionMode]}
      </Text>
      <Text>
        {status === 'running' ? '● working   ' : ''}
        {status === 'error' ? '⚠ error   ' : ''}
        {typeof costUsd === 'number' ? `$${costUsd.toFixed(2)}   ` : ''}
        {formatElapsed(elapsedMs)}
      </Text>
    </Box>
  );
}
