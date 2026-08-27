const LABEL: Record<string, string> = {
  claude: "Claude",
  "claude-code": "Claude",
  codex: "Codex",
  opencode: "OpenCode",
  kilo: "Kilo Code",
  goose: "Goose",
  hermes: "Hermes",
  gemini: "Gemini",
  qwen: "Qwen",
  droid: "Droid",
  amp: "Amp",
  kimi: "Kimi",
  codebuff: "Codebuff",
  openclaw: "OpenClaw",
  pi: "Pi",
  copilot: "GitHub Copilot",
  cursor: "Cursor",
  antigravity: "Antigravity",
  kilocode: "Kilo Code",
  openrouter: "OpenRouter"
};

const COLOR: Record<string, string> = {
  claude: "var(--brand)",
  "claude-code": "var(--brand)",
  codex: "var(--data-5)",
  opencode: "var(--data-2)",
  kilo: "var(--data-4)",
  goose: "var(--data-3)",
  hermes: "var(--data-5)",
  gemini: "var(--data-3)",
  qwen: "var(--data-4)",
  droid: "var(--data-2)",
  amp: "var(--data-1)",
  kimi: "var(--data-4)",
  codebuff: "var(--data-2)",
  openclaw: "var(--data-3)",
  pi: "var(--data-5)",
  copilot: "var(--muted-foreground)",
  cursor: "var(--brand-2)",
  antigravity: "var(--data-1)",
  kilocode: "var(--data-4)"
};

export const provLabel = (s: string) => LABEL[s] || s;
export const provColor = (s: string) => COLOR[s] || "var(--data-3)";
