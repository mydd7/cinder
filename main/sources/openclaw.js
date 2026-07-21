const fs = require("fs");
const path = require("path");
const { num, walk, readJsonl, mapLimit, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("OPENCLAW_DIR");
  const roots = env.length
    ? env
    : [".openclaw", ".clawdbot", ".moltbot", ".moldbot"].map((d) => path.join(HOME, d));
  return [...new Set(roots)].filter((d) => fs.existsSync(d));
}

function modelOf(o) {
  const d = o.data || o;
  return d.modelId || d.model || (o.message && (o.message.modelId || o.message.model));
}

function usageOf(o) {
  const msg = o.message || o;
  if (msg.role && msg.role !== "assistant") return null;
  const u = msg.usage;
  if (!u) return null;
  const input = num(u.input);
  const output = num(u.output);
  const cacheRead = num(u.cache_read != null ? u.cache_read : u.cacheRead);
  const cacheWrite = num(u.cacheWrite != null ? u.cacheWrite : u.cache_write);
  if (input + output + cacheRead + cacheWrite === 0) return null;
  return { input, output, cacheRead, cacheWrite, model: msg.modelId || msg.model, ts: msg.timestamp || o.timestamp, id: msg.id };
}

async function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 16, (file) =>
      cx.scanFile("openclaw", dir, file, async (out) => {
        let current = null;
        await readJsonl(file, (o) => {
          const m = modelOf(o);
          if (m) current = m;
          const u = usageOf(o);
          if (!u) return;
          out.add({
            source: "openclaw",
            ts: u.ts,
            model: u.model || current || "openclaw",
            provider: "openclaw",
            session: path.basename(file, ".jsonl"),
            input: u.input,
            output: u.output,
            cacheWrite: u.cacheWrite,
            cacheRead: u.cacheRead,
            dedup: u.id != null ? String(u.id) : undefined
          });
        });
      })
    );
  }
}

module.exports = { id: "openclaw", label: "OpenClaw", collect };
