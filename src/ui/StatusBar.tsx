import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { colors, ruleBorder } from './theme.js';
import type { PermissionMode } from '../sdk/types.js';
import type { SessionStatus } from './types.js';

interface Props {
  model: string;
  permissionMode: PermissionMode;
  elapsedMs: number;
  costUsd?: number;
  status: SessionStatus;
  contextPercent?: number;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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

const DIVIDER = '   │   ';

export function StatusBar({ model, permissionMode, elapsedMs, costUsd, status, contextPercent }: Props): React.JSX.Element {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  // Ticks only while a turn is in flight — fast enough to read as motion, unlike the 1s elapsed clock.
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setSpinnerFrame((frame) => frame + 1), 100);
    return () => clearInterval(id);
  }, [status]);

  return (
    <Box {...ruleBorder('top')} paddingX={1} justifyContent="space-between">
      <Text>
        <Text color={colors.accent} bold>
          {model}
        </Text>
        <Text color={colors.border}>{DIVIDER}</Text>
        <Text color={colors.dim}>{MODE_LABEL[permissionMode]}</Text>
      </Text>
      <Text>
        {status === 'running' && (
          <Text color={colors.accent}>
            {SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]} working
            <Text color={colors.border}>{DIVIDER}</Text>
          </Text>
        )}
        {status === 'error' && (
          <Text color={colors.danger}>
            ⚠ error
            <Text color={colors.border}>{DIVIDER}</Text>
          </Text>
        )}
        {typeof contextPercent === 'number' && (
          <Text color={colors.dim}>
            {`${contextPercent}% context`}
            <Text color={colors.border}>{DIVIDER}</Text>
          </Text>
        )}
        {typeof costUsd === 'number' && (
          <Text color={colors.dim}>
            {`$${costUsd.toFixed(2)}`}
            <Text color={colors.border}>{DIVIDER}</Text>
          </Text>
        )}
        <Text color={colors.dim}>{formatElapsed(elapsedMs)}</Text>
      </Text>
    </Box>
  );
}
