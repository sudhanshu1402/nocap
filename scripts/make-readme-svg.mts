#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { narrate } from '../src/narrator/narrate.js';
import { classifyRisk } from '../src/permission/riskClassifier.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace';
const CELL = 8.4;
const LINE = 24;
const PAD = 24;
const BAR = 38;

const COLOR = {
  bg: '#0d1117',
  bar: '#161b22',
  edge: '#30363d',
  head: '#e6edf3',
  dim: '#7d8590',
  text: '#c9d1d9',
  low: '#3fb950',
  medium: '#d29922',
  high: '#f85149',
  cool: '#58a6ff',
};

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// SVG collapses runs of spaces; NBSP has the same advance width in a monospace face.
function cells(text: string): string {
  return escape(text).replace(/ /g, '\u00a0');
}

// Alt text is captured output, so a quoted tool input would close the attribute early.
function attr(text: string): string {
  return escape(text).replace(/"/g, '&quot;');
}

function frame(width: number, height: number, title: string, label: string): string {
  const dots = ['#ff5f57', '#febc2e', '#28c840']
    .map((fill, i) => `<circle cx="${20 + i * 18}" cy="19" r="6" fill="${fill}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${attr(label)}">
  <rect width="${width}" height="${height}" rx="10" fill="${COLOR.bg}" stroke="${COLOR.edge}"/>
  <path d="M0 10a10 10 0 0 1 10-10h${width - 20}a10 10 0 0 1 10 10v28H0z" fill="${COLOR.bar}"/>
  ${dots}
  <text x="${PAD + 48}" y="23" font-family="${MONO}" font-size="12" fill="${COLOR.dim}">${attr(title)}</text>`;
}

const TILES: [string, string, string, string][] = [
  ['WHAT', 'plain English', 'not tool-call JSON', COLOR.cool],
  ['NARRATION', 'zero tokens', 'generated on your machine', COLOR.low],
  ['APPROVAL', 'card first', 'never says yes for you', COLOR.medium],
  ['UNDERNEATH', 'real Claude Code', 'your hooks, MCP, skills', COLOR.head],
];

function glance(): string {
  // A 195px tile at font-size 11 holds about 26 monospace glyphs before it clips.
  for (const [, , small] of TILES) if (small.length > 26) throw new Error(`tile caption too long: ${small}`);
  const width = 880;
  const height = 150;
  const tiles = TILES.map(([role, big, small, fill], i) => {
    const x = 20 + i * 215;
    return `<rect x="${x}" y="30" width="195" height="96" rx="8" fill="${COLOR.bar}" stroke="${COLOR.edge}"/>
    <text x="${x + 14}" y="56" fill="${COLOR.dim}" font-size="11" letter-spacing="1">${role}</text>
    <text x="${x + 14}" y="82" fill="${fill}" font-size="15" font-weight="600">${cells(big)}</text>
    <text x="${x + 14}" y="106" fill="${COLOR.dim}" font-size="11">${cells(small)}</text>`;
  }).join('\n    ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="nocap at a glance: plain English instead of tool-call JSON, narration generated locally for zero tokens, an approval card before anything risky, real Claude Code underneath with your hooks, MCP servers and skills">
  <rect width="${width}" height="${height}" rx="10" fill="${COLOR.bg}" stroke="${COLOR.edge}"/>
  <g font-family="${MONO}">
    ${tiles}
  </g>
</svg>
`;
}

// Real tool_use payloads; every line in the picture is what narrate() returns for them.
const CALLS: [string, Record<string, unknown>][] = [
  ['Read', { file_path: `${process.cwd()}/src/auth/session.ts` }],
  ['Grep', { pattern: 'verifyToken', path: `${process.cwd()}/src` }],
  ['Edit', { file_path: `${process.cwd()}/src/auth/session.ts` }],
  ['Bash', { command: 'npm test -- auth', description: 'run the auth tests' }],
  ['Task', { subagent_type: 'code-reviewer', description: 'review the session change' }],
  ['mcp__linear__create_issue', { prompt: 'token refresh races on expiry' }],
  ['Bash', { command: 'rm -rf build dist' }],
];

const INSIGHTS_FOOT = 'every tool call is narrated, approved or not, so nothing happens off-screen';

function insights(): string {
  const lines = CALLS.map(([tool, input], i) => narrate(`call-${i}`, tool, input));
  const gutter = Math.round(PAD + 26 * CELL);
  let y = BAR + 30;
  const rows = lines.map(({ toolName, text, risk }) => {
    const top = y;
    y += risk === 'low' ? LINE : LINE + 18;
    return `<text x="${PAD}" y="${top}" fill="${COLOR.dim}" font-size="12">${cells(toolName.padEnd(26).slice(0, 26))}</text>
    <text x="${gutter}" y="${top}" fill="${COLOR.text}" font-size="13">${cells(text)}</text>
    ${risk === 'low' ? '' : `<text x="${gutter}" y="${top + 17}" fill="${COLOR[risk]}" font-size="11">${cells(`needs approval: ${risk} risk`)}</text>`}`;
  }).join('\n    ');
  // The footer is fixed text, so it has to be measured too or a short narration clips it.
  const widest = Math.max(INSIGHTS_FOOT.length, ...lines.map((l) => l.text.length + 30));
  const width = Math.round(widest * CELL + PAD * 2);
  const height = y + 40;
  return `${frame(width, height, 'Insights, generated locally, 0 tokens', `The Insights pane: ${lines.map((l) => l.text).join('; ')}`)}
  <g font-family="${MONO}">
    ${rows}
    <text x="${PAD}" y="${height - 16}" fill="${COLOR.dim}" font-size="11">${cells(INSIGHTS_FOOT)}</text>
  </g>
</svg>
`;
}

const DANGER = 'rm -rf build dist';
const KEYS_FOOT = '[y] yes   [n] no   [a] always allow this tool this session';

function approval(): string {
  const { level, reason, saferAlternative } = classifyRisk('Bash', { command: DANGER });
  const rows: [string, string, string][] = [
    ['command', DANGER, COLOR.head],
    ['risk', `${level}: ${reason}`, COLOR[level]],
    ['nocap asks', saferAlternative ?? 'run it?', COLOR.cool],
  ];
  const widest = Math.max(KEYS_FOOT.length, ...rows.map(([k, v]) => k.length + v.length + 4));
  const width = Math.round(widest * CELL + PAD * 2);
  const height = BAR + 34 + rows.length * LINE + 52;
  const gutter = Math.round(PAD + 12 * CELL);
  const body = rows.map(([key, value, fill], i) => {
    const y = BAR + 34 + i * LINE;
    return `<text x="${PAD}" y="${y}" fill="${COLOR.dim}" font-size="12">${cells(key.padEnd(12))}</text>
    <text x="${gutter}" y="${y}" fill="${fill}" font-size="13">${cells(value)}</text>`;
  }).join('\n    ');
  return `${frame(width, height, `Approval card, ${level} risk`, `Approval card for ${DANGER}: ${level} risk, ${reason}, ${saferAlternative ?? ''}`)}
  <g font-family="${MONO}">
    ${body}
    <text x="${PAD}" y="${height - 18}" fill="${COLOR.text}" font-size="13">${cells(KEYS_FOOT)}</text>
  </g>
</svg>
`;
}

mkdirSync(join(ROOT, 'assets'), { recursive: true });
// A classifier change that stopped calling this high risk would leave the README lying.
const assessed = classifyRisk('Bash', { command: DANGER });
if (assessed.level !== 'high') throw new Error(`expected high risk for "${DANGER}", got ${assessed.level}`);

const shots: [string, string][] = [['glance.svg', glance()], ['insights.svg', insights()], ['approval.svg', approval()]];
for (const [name, markup] of shots) {
  writeFileSync(join(ROOT, 'assets', name), markup);
  process.stdout.write(`wrote assets/${name}\n`);
}
