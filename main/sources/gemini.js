const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { num, walk, mapLimit, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("GEMINI_DATA_DIR");
  if (env.length) return env.filter((d) => fs.existsSync(d));
  const d = path.join(HOME, ".gemini", "tmp");
  return fs.existsSync(d) ? [d] : [];
}

function pick(obj, keys) {
  for (const k of keys) if (obj[k] != null) return num(obj[k]);
  return 0;
}

function tokensFrom(obj) {
  if (!obj || typeof obj !== "object") return null;
  const input = pick(obj, ["input", "prompt", "input_tokens", "prompt_tokens", "promptTokenCount"]);
  const output = pick(obj, ["output", "candidates", "output_tokens", "candidates_tokens", "candidatesTokenCount"]);
  const cached = pick(obj, ["cached", "cached_tokens", "cachedContentTokenCount"]);
  const thoughts = pick(obj, ["thoughts", "reasoning", "thoughts_tokens", "reasoning_tokens", "thoughtsTokenCount"]);
  const tool = pick(obj, ["tool", "tool_tokens"]);
  if (input + output + cached + thoughts + tool === 0) return null;
  return {
    input: Math.max(0, input - cached) + tool,
    output,
    cacheRead: cached,
    reasoning: thoughts
  };
}

function record(o, file, out) {
  const stats = o.tokens || o.stats || (o.result && o.result.stats) || o.usageMetadata;
  const t = tokensFrom(stats);
  if (!t) return;
  out.add({
    source: "gemini",
    ts: o.timestamp || o.created_at || o.lastUpdated || o.last_updated || o.startTime || o.start_time || fs.statSync(file).mtime,
    model: o.model || "gemini",
    provider: "google",
    session: o.sessionId || o.session_id || path.basename(file, path.extname(file)),
    input: t.input,
    output: t.output,
    cacheWrite: 0,
    cacheRead: t.cacheRead,
    reasoning: t.reasoning,
    dedup: o.id || o.messageId || undefined
  });
}

async function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".json", (f) => files.push(f));
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 16, (file) =>
      cx.scanFile("gemini", dir, file, async (out) => {
        let raw;
        try {
          raw = await fsp.readFile(file, "utf8");
        } catch {
          return;
        }
        if (file.endsWith(".jsonl")) {
          for (const line of raw.split(/\r?\n/)) {
            if (!line.trim()) continue;
            try {
              record(JSON.parse(line), file, out);
            } catch {}
          }
        } else {
          try {
            record(JSON.parse(raw), file, out);
          } catch {}
        }
      })
    );
  }
}

module.exports = { id: "gemini", label: "Gemini", collect };
