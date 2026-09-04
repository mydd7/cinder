# Cinder

Local desktop dashboard for AI coding token usage. Reads local logs only, nothing leaves the machine. MIT.

<img src="icon/icon.png" width="72" alt="Cinder" />

<img src="docs/overview.png" alt="Overview" />

<img src="docs/activity.png" alt="Activity" />

<img src="docs/calls.png" alt="Calls" />

<img src="docs/sessions.png" alt="Sessions" />

## Install

Windows and macOS builds are on [releases](https://github.com/mydd7/cinder/releases). macOS is unsigned: right-click the app → Open. Linux: `npm run build` produces an AppImage.

## Setup

1. `npm install`
2. `npm start`

## Dev

- `npm run dev` — Vite + Electron with devtools
- `npm test` — unit tests
- `npm run check` — TypeScript

## Build

1. `npm run build:web` — renderer to `dist/`
2. `npm run dist` — unpacked app
3. `npm run build` — installer for the current OS
4. `npm run icons` — regenerates `icon/` from `tools/make-icons.js`

## Stack

Electron, React 19, Vite, Tailwind v4, hugeicons. Renderer in `src/`, collectors in `main/`, bridge in `preload.js`.

## Sources

Claude, Codex, OpenCode, Kilo, Goose, Hermes, Gemini, Qwen, Droid, Amp, Kimi, Codebuff, OpenClaw, Pi, GitHub Copilot, Cursor, Antigravity. Each reader lives in `main/sources/` and uses its default paths plus an override env var (comma or semicolon separated):

`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `OPENCODE_DATA_DIR`, `KILO_DATA_DIR`, `GOOSE_PATH_ROOT`, `HERMES_HOME`, `GEMINI_DATA_DIR`, `QWEN_DATA_DIR`, `DROID_SESSIONS_DIR`, `AMP_DATA_DIR`, `KIMI_DATA_DIR`, `CODEBUFF_DATA_DIR`, `OPENCLAW_DIR`, `PI_AGENT_DIR`, `COPILOT_OTEL_FILE_EXPORTER_PATH`, `CURSOR_DATA_DIR`, `CURSOR_TRACKING_DB`, `ANTIGRAVITY_DATA_DIR`.

SQLite sources use `node:sqlite`. Antigravity stores usage as protobuf with no `.proto`, so the reader decodes by field number. Cursor does not persist token counts locally: requests, models, sessions and tool calls only.

## Pricing

Per-model cost from a bundled `pricing-data.json`. Unknown models are zero. No network at runtime.

`npm run pricing` rebuilds the snapshot from LiteLLM and models.dev. LiteLLM wins conflicts.

## Calls

Tool, MCP and skill counts from local logs (Claude, Codex, OpenCode, Cursor). Deduped by call id, cached in `calls-cache.json`.

## Scan

Completed scans go to `scan-snapshot.json` in the app data dir. On launch, open the last scan or run a new one. Large log sets are streamed; usage is compacted per minute per session/model.

## Shortcuts

`Ctrl/Cmd+R` rescan, `Ctrl/Cmd+1..8` switch view. Theme, mode, period and window geometry persist.
