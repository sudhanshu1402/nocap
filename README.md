# nocap

**no cap, no jargon — just tells you what it's actually doing.**

[![CI](https://github.com/sudhanshu1402/nocap/actions/workflows/ci.yml/badge.svg)](https://github.com/sudhanshu1402/nocap/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40sudhanshu1402%2Fnocap.svg?color=CB3837&logo=npm)](https://www.npmjs.com/package/@sudhanshu1402/nocap)
[![node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

nocap is a plain-English terminal app for [Claude Code](https://claude.com/claude-code). It's
the same real Claude Code underneath — real filesystem access, hooks, MCP servers, skills,
subagents, the same permission system — but instead of raw tool-call JSON and diffs, you get a
readable feed of what Claude is doing and a clear Yes/No card before anything risky happens.

## Quickstart (2 minutes)

```
npx @sudhanshu1402/nocap
```

That's it. First time you run it, a short setup wizard walks you through:

1. **Your Anthropic API key** — pasted once, optionally saved locally (permissions locked to
   your user only).
2. **A default model** — Sonnet 5 (balanced), Opus 4.8 (most capable), or Haiku 4.5 (fastest/
   cheapest). Plain-English hints, no need to know pricing.
3. **How approvals work** — nocap always asks before risky actions. This isn't a toggle you can
   turn off from the wizard.
4. **Anonymous usage telemetry** — off by default, your choice.

After that, just type what you want done, like you would to a person.

To install it permanently instead of using `npx` each time:

```
npm install -g @sudhanshu1402/nocap
nocap
```

## What you're looking at

- **Main pane (left)** — your conversation with Claude: what you typed, what Claude says back.
- **Insights (right)** — a running plain-English log of every action Claude takes (reading a
  file, running a command, searching the web, etc.), whether or not it needed your approval.
  This is generated locally — it never costs you extra tokens.
- **Status bar (bottom)** — running cost in dollars, elapsed time, current permission mode, and
  the active model.
- **Approval card** — pops up before anything consequential (editing/deleting files, running a
  shell command, etc.). `y` approve · `n` deny · `a` always allow this tool for the session.
  nocap never approves anything on your behalf — every risky action waits for you.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Enter` | send message |
| `Ctrl+J` | newline in the input box |
| `Esc` | interrupt the current turn |
| `y` / `n` / `a` | approve / deny / always-allow (on an approval card) |
| `Ctrl+Z` | undo the last change (file checkpoint, or a git snapshot for shell-made changes) |
| `Ctrl+H` | browse and resume a past session |
| `PgUp` / `PgDn` | scroll the transcript |
| `Ctrl+C` | quit |

## Scripting / CI use

For a single non-interactive turn (no terminal UI):

```
nocap --once "list the files in this repo"
```

Requires either `ANTHROPIC_API_KEY` in the environment or an existing `claude` CLI login —
the wizard only runs in an interactive terminal.

## Safety

- Never auto-approves a risky or irreversible action — every one goes through an approval card.
- Never logs or displays your API key or other secrets, including in crash output.
- Full Claude Code capability is preserved (your real hooks, MCP servers, skills, subagents,
  permission modes) — nocap is a UI layer, not a sandboxed subset.
- Telemetry is off unless you opt in during setup.

## Contributing

```
git clone https://github.com/sudhanshu1402/nocap.git
cd nocap
npm install
npm run dev          # run against the real SDK (needs ANTHROPIC_API_KEY)
npm run lint && npm run typecheck && npm test && npm run build
```

Requires Node ≥22. No `ink-text-input` or other third-party Ink input components — inputs are
built directly on Ink's `useInput`/`usePaste` to avoid version drift.

## License

MIT
