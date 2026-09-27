# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-09-27
### Fixed
- Risk classifier: when several Bash rules match one command, the highest risk level now wins. Before, the first rule in the list decided.
- Headless `--once` mode gives up after 5 minutes with no result from the model instead of hanging.
- Glob patterns, WebSearch queries and subagent names and descriptions are now redacted in the feed.
- A newer approval request for the same tool use denies the older one instead of leaving it pending, and the abort listener is removed once a request settles.
- An error thrown by a message listener goes to the error listeners instead of escaping the message loop.
- Enter submits the latest typed text, held in a ref, instead of the value from the last render.
- A tool-use block whose input is not an object is no longer treated as a tool call.

### Changed
- The setup wizard no longer asks about telemetry. The answer was stored and never used.
- Runtime dependencies updated: @anthropic-ai/claude-agent-sdk 0.3.207 to 0.3.251, @anthropic-ai/sdk ^0.111.0 to ^0.122.0, ink 7.1.0 to 7.1.1, react 19.2.7 to 19.2.8.
- The README on npm now matches the repository.

## [0.1.0] - 2026-07-11
### Added
- Initial release: real Claude Agent SDK session driven from a split-pane Ink terminal UI.
- Plain-English Insights panel narrating tool actions (~15 common tools + fallback).
- Approval cards for every risky/irreversible action - never auto-approved.
- Running cost meter, elapsed time, permission mode, and model shown in the status bar.
- File checkpointing (undo) and session history browser.
- First-run setup wizard for API key, model choice, and permission defaults.
