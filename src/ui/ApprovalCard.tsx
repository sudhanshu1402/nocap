import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './theme.js';
import type { ApprovalRequest } from '../permission/approvalMachine.js';

interface Props {
  request: ApprovalRequest;
  queuedCount: number; // requests waiting behind this one
  onApprove: (remember: boolean) => void;
  onDeny: () => void;
}

/**
 * Concise & neutral approval card. Renders only while a request is pending;
 * mounted conditionally by the parent, so it's the only thing capturing y/n/a
 * input — never auto-approves, never renders a decision on its own.
 */
export function ApprovalCard({ request, queuedCount, onApprove, onDeny }: Props): React.JSX.Element {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') onApprove(false);
    else if (key === 'a') onApprove(true);
    else if (key === 'n') onDeny();
  });

  const headline = request.title ?? `Claude wants to use ${request.displayName ?? request.toolName}`;
  const subtitle = request.description ?? request.risk.reason;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.risk[request.risk.level]} paddingX={1}>
      <Text bold>
        approval needed{queuedCount > 0 ? `  (+${queuedCount} waiting)` : ''}
      </Text>
      <Text>{headline}</Text>
      {subtitle && (
        <Text color={colors.dim} dimColor>
          {subtitle}
        </Text>
      )}
      {request.risk.saferAlternative && (
        <Text color={colors.dim} dimColor>
          safer: {request.risk.saferAlternative}
        </Text>
      )}
      <Text>
        <Text color={colors.success}>[y] approve</Text>
        {'   '}
        <Text color={colors.accent}>[a] always allow this</Text>
        {'   '}
        <Text color={colors.danger}>[n] deny</Text>
      </Text>
    </Box>
  );
}
