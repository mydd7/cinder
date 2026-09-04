const fs = require("fs");
const path = require("path");
const { num, walk, readJsonl, mapLimit, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("PI_AGENT_DIR");
  const roots = env.length ? env : [path.join(HOME, ".pi", "agent", "sessions")];
  return [...new Set(roots)].filter((d) => fs.existsSync(d));
}

async function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 16, (file) =>
      cx.scanFile("pi", dir, file, async (out) => {
        await readJsonl(file, (o) => {
          const msg = o.message;
          if (!msg || (msg.role && msg.role !== "assistant") || !msg.usage) return;
          const u = msg.usage;
          const input = num(u.input);
          const output = num(u.output);
          const cacheRead = num(u.cache_read != null ? u.cache_read : u.cacheRead);
          const cacheWrite = num(u.cacheWrite != null ? u.cacheWrite : u.cache_write);
          if (input + output + cacheRead + cacheWrite === 0) return;
          out.add({
            source: "pi",
            ts: o.timestamp,
            model: msg.model || "pi",
            provider: "pi",
            session: path.basename(file, ".jsonl"),
            input,
            output,
            cacheWrite,
            cacheRead,
            dedup: msg.id != null ? String(msg.id) : undefined
          });
        }, (line) => line.includes('"usage"'));
      })
    );
  }
}

module.exports = { id: "pi", label: "Pi", collect };
