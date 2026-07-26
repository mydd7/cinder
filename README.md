# Cinder

local desktop dashboard for AI coding token usage. reads local logs only, nothing leaves the machine.

<img src="icon/icon.png" width="96" alt="" />

## Setup
1. `npm install`
2. `npm start`

## Dev
1. `npm run dev` runs the Vite dev server and Electron with devtools

## Build
1. `npm run build:web` builds the renderer to `dist/`
2. `npm run dist` packages an unpacked app
3. `npm run build` produces an installer for the current OS
4. `npm run icons` regenerates `icon/` from the mark geometry in `tools/make-icons.js`

## Stack
Electron shell, React 19, Vite, Tailwind v4, shadcn/ui, hugeicons. renderer in `src/`, collector and source readers in `main/`, bridge in `preload.js`.

## Sources
Claude, Codex, OpenCode, Kilo, Goose, Hermes, Gemini, Qwen, Droid, Amp, Kimi, Codebuff, OpenClaw, Pi, GitHub Copilot. each reader lives in `main/sources/` and resolves its own default paths plus an override env var. SQLite sources use the built-in `node:sqlite`.

## Pricing
cost is computed per model from a bundled `pricing-data.json` snapshot of model prices, keyed by model id with a provider-qualified fallback. unknown models resolve to zero.

## Shortcuts
`Ctrl/Cmd+R` rescan, `Ctrl/Cmd+1..7` switch view. theme, mode, period and window geometry persist between launches.
