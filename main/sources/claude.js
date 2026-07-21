const fs = require("fs");
const path = require("path");
const { num, walk, readJsonl, mapLimit, envDirs, HOME } = require("../normalize");

function roots() {
  const out = [];
  const push = (dir) => {
    if (dir && fs.existsSync(path.join(dir, "projects")) && !out.includes(dir)) out.push(dir);
  };
  const env = envDirs("CLAUDE_CONFIG_DIR");
  if (env.length) {
    for (let raw of env) {
      if (path.basename(raw) === "projects") raw = path.dirname(raw);
      push(raw);
    }
    if (out.length) return out;
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  push(path.join(xdg, "claude"));
  push(path.join(HOME, ".claude"));
  return out;
}

function usage(msg) {
  const u = msg && msg.usage;
  if (!u || typeof u !== "object") return null;
  if (!u.input_tokens && !u.output_tokens && Array.isArray(u.iterations)) {
    const agg = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    for (const it of u.iterations) {
      agg.input += num(it.input_tokens) + num(it.prompt_tokens);
      agg.output += num(it.output_tokens) + num(it.completion_tokens);
      agg.cacheWrite += num(it.cache_creation_input_tokens);
      agg.cacheRead += num(it.cache_read_input_tokens) + num(it.cached_tokens);
    }
    return agg;
  }
  return {
    input: num(u.input_tokens) + num(u.prompt_tokens),
    output: num(u.output_tokens) + num(u.completion_tokens),
    cacheWrite: num(u.cache_creation_input_tokens),
    cacheRead: num(u.cache_read_input_tokens) + num(u.cached_tokens)
  };
}

async function collect(cx) {
  for (const root of roots()) {
    const dir = path.join(root, "projects");
    const files = [];
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 16, (file) =>
      cx.scanFile("claude", dir, file, async (out) => {
        await readJsonl(file, (o) => {
          const msg = o.message;
          if (!msg) return;
          const u = usage(msg);
          if (!u) return;
          const id = (msg.id || "") + ":" + (o.requestId || "");
          out.add({
            source: "claude",
            ts: o.timestamp || msg.timestamp,
            model: msg.model,
            provider: "anthropic",
            project: o.cwd ? path.basename(o.cwd) : path.basename(path.dirname(file)),
            session: o.sessionId || path.basename(file, ".jsonl"),
            input: u.input,
            output: u.output,
            cacheWrite: u.cacheWrite,
            cacheRead: u.cacheRead,
            cost: typeof o.costUSD === "number" ? o.costUSD : undefined,
            dedup: id !== ":" ? id : undefined
          });
        });
      })
    );
  }
}

module.exports = { id: "claude", label: "Claude", collect };
