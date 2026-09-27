<div align="center">

<img src="https://raw.githubusercontent.com/sudhanshu1402/nocap/main/assets/hero.svg" width="100%" alt="nocap: NO CAP. It asks before rm -rf. A plain-English terminal UI for Claude Code. A high-risk approval card for rm -rf build dist offers to move the files to trash, with y, n and a keys. Narrated locally, zero extra tokens." />

[![CI](https://github.com/sudhanshu1402/nocap/actions/workflows/ci.yml/badge.svg)](https://github.com/sudhanshu1402/nocap/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/%40sudhanshu1402%2Fnocap.svg?color=CB3837&logo=npm)](https://www.npmjs.com/package/@sudhanshu1402/nocap) [![node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

**no cap, no jargon, just tells you what it's actually doing.**

A plain-English terminal app for [Claude Code](https://claude.com/claude-code). Real Claude Code underneath, with your actual filesystem access, hooks, MCP servers, skills, subagents, and permission system. The difference is what you see: a readable feed of what Claude is doing instead of raw tool-call JSON, and a clear Yes/No card before anything risky.

![The Insights pane: reading src/auth/session.ts, searching for verifyToken in src, editing src/auth/session.ts, run the auth tests, delegating to code-reviewer, create issue via linear, running rm -rf build dist flagged high risk](https://raw.githubusercontent.com/sudhanshu1402/nocap/main/assets/insights.svg)

Those lines are what `narrate()` returns for real tool-call payloads, generated on your machine by string templates. No second model call, no extra tokens.

## Start

```bash
npx @sudhanshu1402/nocap
```

First run walks you through a short wizard: your Anthropic API key (pasted once, optionally saved with permissions locked to your user), a default model, and how approvals work. nocap sends no telemetry and has no analytics; the only network call it makes is to the Anthropic API. Then type what you want done, like you would to a person.

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

![Approval card for rm -rf build dist: high risk, deletes files permanently and cannot be undone, nocap asks whether to move the files to trash instead, with y for yes, n for no, a for always allow](https://raw.githubusercontent.com/sudhanshu1402/nocap/main/assets/approval.svg)

The risk level, the reason and the safer alternative in that card are what `classifyRisk()` returns for `rm -rf build dist`; the classifier reads the command, not a keyword list, so `-r -f` split across two flags is caught the same way.

Every risky or irreversible action goes through an approval card, and that isn't a toggle the wizard can turn off. API keys and secrets are never logged or displayed, including in crash output. nocap is a UI layer, not a sandboxed subset, so your real hooks, MCP servers, skills, and permission modes all still apply.

## Contributing

```bash
git clone https://github.com/sudhanshu1402/nocap.git
cd nocap && npm install
npm run dev
npm run lint && npm run typecheck && npm test && npm run build
npm run assets   # regenerates the two captured images above from src/
```

Inputs are built directly on Ink's `useInput` and `usePaste`. No `ink-text-input` or other third-party Ink input components, to avoid version drift.

---

<sub>Part of [sudhanshu1402](https://github.com/sudhanshu1402)'s work: [keel](https://github.com/sudhanshu1402/keel) · **nocap** · [receipts](https://github.com/sudhanshu1402/receipts) · [enterprise-auth-stack](https://github.com/sudhanshu1402/enterprise-auth-stack) · [distributed-queue-engine](https://github.com/sudhanshu1402/distributed-queue-engine) · [multi-region-mongo-patterns](https://github.com/sudhanshu1402/multi-region-mongo-patterns) · [otel-sdk-node](https://github.com/sudhanshu1402/otel-sdk-node) · [llm-assessment-pipeline](https://github.com/sudhanshu1402/llm-assessment-pipeline). Write-ups on the [System Design Portal](https://sudhanshu1402.github.io/system-design-portal/).</sub>

## License

MIT
