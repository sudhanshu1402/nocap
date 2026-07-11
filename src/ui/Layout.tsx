import React from 'react';
import { Box, useWindowSize } from 'ink';
import { Transcript } from './Transcript.js';
import { InsightsPanel } from './InsightsPanel.js';
import { StatusBar } from './StatusBar.js';
import { colors } from './theme.js';
import type { ChatEntry, SessionStatus } from './types.js';
import type { InsightLine } from '../narrator/narrate.js';
import type { PermissionMode } from '../sdk/types.js';

const WIDE_BREAKPOINT = 100;
const RESERVED_ROWS = 6; // status bar + docked input/card + borders/margins

interface Props {
  entries: ChatEntry[];
  streamingText: string;
  insights: InsightLine[];
  model: string;
  permissionMode: PermissionMode;
  elapsedMs: number;
  costUsd?: number;
  status: SessionStatus;
  scrollOffset: number;
  bottom: React.ReactNode; // ApprovalCard when pending, else PromptInput
}

export function Layout(props: Props): React.JSX.Element {
  const { columns, rows } = useWindowSize();
  const isWide = columns >= WIDE_BREAKPOINT;
  const bodyRows = Math.max(3, rows - RESERVED_ROWS);

  const transcript = (
    <Transcript
      entries={props.entries}
      streamingText={props.streamingText}
      maxVisible={isWide ? bodyRows : Math.max(2, Math.floor(bodyRows * 0.6))}
      scrollOffset={props.scrollOffset}
    />
  );
  const insights = (
    <InsightsPanel
      lines={props.insights}
      maxVisible={isWide ? bodyRows : Math.max(2, Math.floor(bodyRows * 0.3))}
    />
  );

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      {isWide ? (
        <Box flexDirection="row" flexGrow={1}>
          <Box flexGrow={1} flexBasis="70%" marginRight={1}>
            {transcript}
          </Box>
          <Box flexBasis="30%" borderStyle="single" borderColor={colors.border} paddingX={1}>
            {insights}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {transcript}
          <Box borderStyle="single" borderColor={colors.border} paddingX={1}>
            {insights}
          </Box>
        </Box>
      )}
      <StatusBar
        model={props.model}
        permissionMode={props.permissionMode}
        elapsedMs={props.elapsedMs}
        costUsd={props.costUsd}
        status={props.status}
      />
      {props.bottom}
    </Box>
  );
}
