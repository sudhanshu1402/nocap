export interface ModelChoice {
  id: string;
  label: string;
  hint: string;
}

// Qualitative tiers only, no invented dollar figures — same discipline as costMeter's pricing table.
export const MODEL_CHOICES: ModelChoice[] = [
  { id: 'claude-sonnet-5', label: 'Sonnet 5', hint: 'balanced — good default for most work' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8', hint: 'most capable — highest cost' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', hint: 'fastest & cheapest — lighter tasks' },
];
