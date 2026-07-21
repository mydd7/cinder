const fs = require("fs");
const path = require("path");
const { num, walk, HOME } = require("../normalize");

const CHANNELS = ["manicode", "manicode-dev", "manicode-staging"];

function files() {
  const env = process.env.CODEBUFF_DATA_DIR;
  const roots = env
    ? env.split(/[,;:]/).map((s) => s.trim()).filter(Boolean)
    : CHANNELS.map((c) => path.join(HOME, ".config", c));
  const out = [];
  for (const root of roots) {
    const projects = path.basename(root) === "projects" ? root : path.join(root, "projects");
    if (!fs.existsSync(projects)) continue;
    walk(projects, ".json", (f) => {
      if (path.basename(f) === "chat-messages.json") out.push(f);
    });
  }
  return out;
}

function usageOf(m) {
  const meta = m.metadata || m;
  const u = (meta && meta.usage) || (meta && meta.codebuff && meta.codebuff.usage) || m.usage;
  if (!u) return null;
  const input = num(u.input_tokens != null ? u.input_tokens : u.inputTokens);
  const output = num(u.output_tokens != null ? u.output_tokens : u.outputTokens);
  const cacheWrite = num(u.cache_creation_input_tokens != null ? u.cache_creation_input_tokens : u.cacheCreationInputTokens);
  const cacheRead = num(u.cache_read_input_tokens != null ? u.cache_read_input_tokens : u.cacheReadInputTokens);
  if (input + output + cacheWrite + cacheRead === 0) return null;
  return { input, output, cacheWrite, cacheRead, model: meta && meta.model };
}

function collect(cx) {
  for (const file of files()) {
    let arr;
    try {
      arr = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const messages = Array.isArray(arr) ? arr : Array.isArray(arr.messages) ? arr.messages : [];
    let mtime;
    try {
      mtime = fs.statSync(file).mtime;
    } catch {
      mtime = null;
    }
    const session = path.basename(path.dirname(file));
    let hits = 0;
    for (const m of messages) {
      const u = usageOf(m);
      if (!u) continue;
      const ok = cx.add({
        source: "codebuff",
        ts: m.timestamp || m.createdAt || m.created_at || mtime,
        model: u.model || "codebuff",
        provider: "codebuff",
        project: session,
        session,
        input: u.input,
        output: u.output,
        cacheWrite: u.cacheWrite,
        cacheRead: u.cacheRead,
        dedup: m.id != null ? String(m.id) : undefined
      });
      if (ok) hits++;
    }
    if (hits > 0) cx.file("codebuff", path.dirname(file));
  }
}

module.exports = { id: "codebuff", label: "Codebuff", collect };
