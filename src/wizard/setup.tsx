import React, { useState } from 'react';
import { Box, Text, useInput, usePaste } from 'ink';
import { colors } from '../ui/theme.js';
import { redact } from '../util/redact.js';
import { looksLikeApiKey } from './validate.js';
import { MODEL_CHOICES } from './models.js';
import { testApiKey as defaultTestApiKey, type TestApiKeyFn } from './testApiKey.js';

export interface WizardResult {
  apiKey: string;
  model: string;
  saveLocally: boolean;
  telemetryOptIn: boolean;
}

interface Props {
  onComplete: (result: WizardResult) => void;
  testApiKeyFn?: TestApiKeyFn;
}

type Step = 'apiKey' | 'testing' | 'saveChoice' | 'model' | 'permission' | 'telemetry';

/**
 * First-run wizard. Only step 3 (permission default) has no interactive
 * choice — it's a static explanation. There is no yolo/bypass toggle in
 * this wizard at all; "ask before risky actions" is the only mode nocap
 * ever starts in, so there's nothing to weaken here.
 */
export function Wizard({ onComplete, testApiKeyFn = defaultTestApiKey }: Props): React.JSX.Element {
  const [step, setStep] = useState<Step>('apiKey');
  const [apiKey, setApiKey] = useState('');
  const [testMessage, setTestMessage] = useState<string | undefined>(undefined);
  const [saveLocally, setSaveLocally] = useState(true);
  const [modelIndex, setModelIndex] = useState(0);

  useInput((input, key) => {
    if (step === 'apiKey') {
      if (key.return) {
        const trimmed = apiKey.trim();
        if (trimmed) setStep('saveChoice');
        return;
      }
      if (key.ctrl && input === 't' && apiKey.trim()) {
        setStep('testing');
        setTestMessage(undefined);
        testApiKeyFn(apiKey.trim())
          .then((result) => {
            setTestMessage(redact(result.message));
            setStep('apiKey');
          })
          .catch((err: unknown) => {
            setTestMessage(redact(err instanceof Error ? err.message : String(err)));
            setStep('apiKey');
          });
        return;
      }
      if (key.backspace || key.delete) {
        setApiKey((v) => v.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta || key.tab || key.escape || key.upArrow || key.downArrow) return;
      if (input) setApiKey((v) => v + input);
      return;
    }

    if (step === 'saveChoice') {
      if (input === 's') {
        setSaveLocally(true);
        setStep('model');
      } else if (input === 'e') {
        setSaveLocally(false);
        setStep('model');
      }
      return;
    }

    if (step === 'model') {
      if (key.upArrow) setModelIndex((i) => Math.max(0, i - 1));
      else if (key.downArrow) setModelIndex((i) => Math.min(MODEL_CHOICES.length - 1, i + 1));
      else if (key.return) setStep('permission');
      return;
    }

    if (step === 'permission') {
      if (key.return) setStep('telemetry');
      return;
    }

    if (step === 'telemetry') {
      const model = MODEL_CHOICES[modelIndex]?.id ?? MODEL_CHOICES[0]!.id;
      if (input === 'y') {
        onComplete({ apiKey: apiKey.trim(), model, saveLocally, telemetryOptIn: true });
      } else if (input === 'n' || key.return) {
        onComplete({ apiKey: apiKey.trim(), model, saveLocally, telemetryOptIn: false });
      }
    }
  });

  usePaste((text) => setApiKey((v) => v + text), { isActive: step === 'apiKey' });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.accent} padding={1} width={64}>
      <Text bold color={colors.accent}>
        welcome to nocap — quick setup (~30s)
      </Text>
      <Box marginTop={1} flexDirection="column">
        {(step === 'apiKey' || step === 'testing') && (
          <Box flexDirection="column">
            <Text>paste your Anthropic API key, then press enter:</Text>
            <Text>{apiKey.length > 0 ? '•'.repeat(apiKey.length) : ''}▏</Text>
            {apiKey.trim().length > 0 && !looksLikeApiKey(apiKey) && (
              <Text color={colors.risk.medium}>doesn&apos;t look like a typical Anthropic key (expected sk-ant-…) — enter still works</Text>
            )}
            {step === 'testing' && <Text color={colors.dim}>testing key…</Text>}
            {testMessage && step === 'apiKey' && <Text color={testMessage.startsWith('key looks valid') ? colors.success : colors.danger}>{testMessage}</Text>}
            <Text color={colors.dim} dimColor>
              [enter] continue · [ctrl+t] test this key live
            </Text>
          </Box>
        )}

        {step === 'saveChoice' && (
          <Box flexDirection="column">
            <Text>save this key for next time?</Text>
            <Text color={colors.dim} dimColor>
              [s] save to ~/.nocap/config.json (chmod 600) · [e] use for this session only
            </Text>
          </Box>
        )}

        {step === 'model' && (
          <Box flexDirection="column">
            <Text>pick a default model (↑↓ then enter):</Text>
            {MODEL_CHOICES.map((m, i) => (
              <Text key={m.id} color={i === modelIndex ? colors.accent : undefined} inverse={i === modelIndex}>
                {i === modelIndex ? '› ' : '  '}
                {m.label} — {m.hint}
              </Text>
            ))}
          </Box>
        )}

        {step === 'permission' && (
          <Box flexDirection="column">
            <Text>permission mode: ask before risky actions</Text>
            <Text color={colors.dim} dimColor>
              nocap always confirms before edits, deletes, and other risky actions — every session.
              there is no bypass/yolo mode in this setup.
            </Text>
            <Text color={colors.dim} dimColor>
              [enter] continue
            </Text>
          </Box>
        )}

        {step === 'telemetry' && (
          <Box flexDirection="column">
            <Text>send anonymous usage telemetry? (default: off)</Text>
            <Text color={colors.dim} dimColor>
              [y] enable · [n] / [enter] keep it off
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
