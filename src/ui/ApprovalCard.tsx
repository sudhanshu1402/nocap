import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, ruleBorder } from './theme.js';
import { redact } from '../util/redact.js';
import { pluralize, shortenPath, truncate } from '../util/format.js';
import type { ApprovalRequest } from '../permission/approvalMachine.js';

interface Props {
  request: ApprovalRequest;
  queuedCount: number; // requests waiting behind this one
  onApprove: (remember: boolean) => void;
  onDeny: () => void;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// Redact before truncate — truncating first can cut a secret mid-string and let the tail slip past the redact regex.
function formatPreview(toolName: string, input: Record<string, unknown>): string | undefined {
  switch (toolName) {
    case 'Bash': {
      const command = str(input.command);
      return command ? truncate(redact(command), 200) : undefined;
    }
    case 'Write': {
      const filePath = shortenPath(str(input.file_path));
      const content = str(input.content);
      return content ? `${filePath}\n${truncate(redact(content), 200)}` : filePath || undefined;
    }
    case 'Edit': {
      const filePath = shortenPath(str(input.file_path));
      const diff = `${truncate(redact(str(input.old_string)), 80)} → ${truncate(redact(str(input.new_string)), 80)}`;
      return filePath ? `${filePath}\n${diff}` : diff;
    }
    case 'MultiEdit': {
      const filePath = shortenPath(str(input.file_path));
      const edits = Array.isArray(input.edits) ? input.edits.length : 0;
      return `${filePath} — ${pluralize(edits, 'edit')}`;
    }
    default: {
      const summary = truncate(redact(JSON.stringify(input)), 150);
      return summary && summary !== '{}' ? summary : undefined;
    }
  }
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
  const preview = formatPreview(request.toolName, request.input);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.risk[request.risk.level]} paddingX={1}>
      <Text bold color={colors.risk[request.risk.level]}>
        ✎ approval needed{queuedCount > 0 ? `  (+${queuedCount} waiting)` : ''}
      </Text>
      <Text>{headline}</Text>
      {subtitle && (
        <Text color={colors.dim} dimColor>
          {subtitle}
        </Text>
      )}
      {preview && (
        <Box {...ruleBorder('left')} paddingLeft={1}>
          <Text color={colors.dim} dimColor>
            {preview}
          </Text>
        </Box>
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
