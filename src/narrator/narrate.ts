import { classifyRisk, type RiskLevel } from '../permission/riskClassifier.js';
import { fallbackLine } from './fallback.js';
import { lookupTemplate } from './templates.js';

export interface InsightLine {
  id: string; // toolUseID, for keying/dedup in the UI
  toolName: string;
  text: string;
  risk: RiskLevel;
  count?: number; // >1 when the UI has collapsed consecutive identical calls
}

/**
 * Dispatch: tool_use block -> one plain-English InsightLine. Purely local
 * (templates + heuristic fallback), so every tool call is narrated for $0.
 */
export function narrate(toolUseId: string, toolName: string, input: Record<string, unknown>): InsightLine {
  const template = lookupTemplate(toolName);
  const text = template ? template(input) : fallbackLine(toolName, input);
  const { level } = classifyRisk(toolName, input);
  return { id: toolUseId, toolName, text, risk: level };
}
