import React from 'react';
import { Box, useWindowSize } from 'ink';
import { Transcript } from './Transcript.js';
import { InsightsPanel } from './InsightsPanel.js';
import { StatusBar } from './StatusBar.js';
import { ruleBorder } from './theme.js';
import type { ChatEntry, SessionStatus } from './types.js';
import type { InsightLine } from '../narrator/narrate.js';
import type { PermissionMode } from '../sdk/types.js';

const WIDE_BREAKPOINT = 100;
const RESERVED_ROWS = 4; // status bar (1 border + 1 content) + docked input (1 border + 1 content)

interface Props {
  entries: ChatEntry[];
  streamingText: string;
  insights: InsightLine[];
  model: string;
  permissionMode: PermissionMode;
  elapsedMs: number;
  costUsd?: number;
  status: SessionStatus;
  contextPercent?: number;
  scrollOffset: number;
  bottom: React.ReactNode; // ApprovalCard when pending, else PromptInput
}

export function Layout(props: Props): React.JSX.Element {
  const { columns, rows } = useWindowSize();
  const isWide = columns >= WIDE_BREAKPOINT;
  const bodyRows = Math.max(3, rows - RESERVED_ROWS);
  const hasInsights = props.insights.length > 0;

  const transcript = (
    <Transcript
      entries={props.entries}
      streamingText={props.streamingText}
      maxVisible={isWide || !hasInsights ? bodyRows : Math.max(2, Math.floor(bodyRows * 0.6))}
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
          <Box flexGrow={1} flexBasis={hasInsights ? '70%' : '100%'} marginRight={hasInsights ? 1 : 0}>
            {transcript}
          </Box>
          {hasInsights && (
            <Box flexBasis="30%" {...ruleBorder('left')} paddingX={1}>
              {insights}
            </Box>
          )}
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {transcript}
          {hasInsights && (
            <Box {...ruleBorder('top')} paddingX={1}>
              {insights}
            </Box>
          )}
        </Box>
      )}
      <StatusBar
        model={props.model}
        permissionMode={props.permissionMode}
        elapsedMs={props.elapsedMs}
        costUsd={props.costUsd}
        status={props.status}
        contextPercent={props.contextPercent}
      />
      {props.bottom}
    </Box>
  );
}
