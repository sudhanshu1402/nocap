import React from 'react';
import { Box, Text } from 'ink';
import { colors } from './theme.js';
import type { InsightLine } from '../narrator/narrate.js';

interface Props {
  lines: InsightLine[];
  maxVisible: number;
}

export function InsightsPanel({ lines, maxVisible }: Props): React.JSX.Element {
  const visible = lines.slice(-maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold color={colors.accent}>
        insights
      </Text>
      {visible.length === 0 && (
        <Text color={colors.dim} dimColor>
          nothing yet
        </Text>
      )}
      {visible.map((line, index) => (
        <Text key={`${line.id}-${index}`} color={colors.risk[line.risk]}>
          › {line.text}
        </Text>
      ))}
    </Box>
  );
}
