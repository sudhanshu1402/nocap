import React from 'react';
import { Box, Text, useInput, usePaste } from 'ink';
import { colors } from './theme.js';

interface Props {
  isActive: boolean;
  value: string;
  onChange: (updater: (prev: string) => string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
}

/**
 * Small controlled text box on Ink's native useInput/usePaste — no
 * ink-text-input dependency (avoids version drift against the freshly
 * released Ink 7). MVP-scoped: append/backspace only, no mid-string cursor
 * movement. Draft lives in the parent (not local state) so it survives this
 * component unmounting behind an approval card mid-turn.
 *
 * onChange always takes a functional updater, never a computed value: Ink
 * can synchronously fire several input/paste events from one stdin chunk
 * (e.g. a held-backspace key-repeat burst) before React re-renders, so
 * handlers here must never compute the next value from the `value` prop —
 * that prop is frozen at last render and stale-value writes collapse to the
 * last one, silently dropping the rest of the burst.
 */
export function PromptInput({ isActive, value, onChange, onSubmit, placeholder = 'message claude…' }: Props): React.JSX.Element {
  useInput(
    (input, key) => {
      if (key.return) {
        const text = value.trim();
        if (text) {
          onSubmit(text);
          onChange(() => '');
        }
        return;
      }
      if (key.ctrl && input === 'j') {
        onChange((prev) => prev + '\n');
        return;
      }
      if (key.backspace || key.delete) {
        onChange((prev) => prev.slice(0, -1));
        return;
      }
      if (key.escape || key.ctrl || key.meta || key.tab || key.upArrow || key.downArrow || key.pageUp || key.pageDown) {
        return; // leave these to global shortcuts
      }
      if (input) onChange((prev) => prev + input);
    },
    { isActive },
  );

  usePaste((text) => onChange((prev) => prev + text), { isActive });

  const isEmpty = value.length === 0;

  return (
    <Box borderStyle="single" borderColor={colors.border} paddingX={1}>
      {isEmpty ? (
        <Text color={colors.dim} dimColor>
          {placeholder}
        </Text>
      ) : (
        <Text>{value}▏</Text>
      )}
    </Box>
  );
}
