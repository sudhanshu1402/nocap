# nocap

**no cap, no jargon, just tells you what it's actually doing.**

[![CI](https://github.com/sudhanshu1402/nocap/actions/workflows/ci.yml/badge.svg)](https://github.com/sudhanshu1402/nocap/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40sudhanshu1402%2Fnocap.svg?color=CB3837&logo=npm)](https://www.npmjs.com/package/@sudhanshu1402/nocap)
[![node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A plain-English terminal app for [Claude Code](https://claude.com/claude-code). Real Claude Code underneath, with your actual filesystem access, hooks, MCP servers, skills, subagents, and permission system. The difference is what you see: a readable feed of what Claude is doing instead of raw tool-call JSON, and a clear Yes/No card before anything risky.

## Start

```bash
npx @sudhanshu1402/nocap
```

First run walks you through a short wizard: your Anthropic API key (pasted once, optionally saved with permissions locked to your user), a default model, how approvals work, and whether to send anonymous telemetry (off unless you opt in). Then type what you want done, like you would to a person.

Install permanently with `npm install -g @sudhanshu1402/nocap`. Needs Node 22+.

## The screen

- **Main pane, left.** Your conversation.
- **Insights, right.** A running plain-English log of every action Claude takes, whether or not it needed approval. Generated locally, so it costs no extra tokens.
- **Status bar.** Running cost in dollars, elapsed time, permission mode, active model.
- **Approval card.** Appears before anything consequential. nocap never approves on your behalf.

| Key | Action |
| --- | --- |
| `Enter` | send |
| `Ctrl+J` | newline |
| `Esc` | interrupt the current turn |
| `y` / `n` / `a` | approve / deny / always-allow this tool for the session |
| `Ctrl+Z` | undo last change (file checkpoint, or git snapshot for shell changes) |
| `Ctrl+H` | browse and resume a past session |
| `Ctrl+C` | quit |

## Scripting

```bash
nocap --once "list the files in this repo"
```

One non-interactive turn, no UI. Needs `ANTHROPIC_API_KEY` in the environment or an existing `claude` CLI login, since the wizard only runs in an interactive terminal.

## Safety

Every risky or irreversible action goes through an approval card, and that isn't a toggle the wizard can turn off. API keys and secrets are never logged or displayed, including in crash output. nocap is a UI layer, not a sandboxed subset, so your real hooks, MCP servers, skills, and permission modes all still apply.

## Contributing

```bash
git clone https://github.com/sudhanshu1402/nocap.git
cd nocap && npm install
npm run dev
npm run lint && npm run typecheck && npm test && npm run build
```

Inputs are built directly on Ink's `useInput` and `usePaste`. No `ink-text-input` or other third-party Ink input components, to avoid version drift.

## License

MIT
