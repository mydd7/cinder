const fs = require("fs");
const path = require("path");
const { num, walk, readJsonl, mapLimit, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("KIMI_DATA_DIR");
  if (env.length) return env.filter((d) => fs.existsSync(d));
  return [path.join(HOME, ".kimi"), path.join(HOME, ".kimi-code")].filter((d) => fs.existsSync(d));
}

function wireFiles(root) {
  const out = [];
  walk(path.join(root, "sessions"), ".jsonl", (f) => {
    if (path.basename(f) === "wire.jsonl") out.push(f);
  });
  return out;
}

function usageFrom(o) {
  const payload = o.message && o.message.payload;
  const tu = (payload && payload.token_usage) || o.usage;
  if (!tu) return null;
  const inputOther = num(tu.input_other != null ? tu.input_other : tu.inputOther);
  const output = num(tu.output);
  const cacheWrite = num(tu.input_cache_creation != null ? tu.input_cache_creation : tu.inputCacheCreation);
  const cacheRead = num(tu.input_cache_read != null ? tu.input_cache_read : tu.inputCacheRead);
  if (inputOther + output + cacheWrite + cacheRead === 0) return null;
  return { input: inputOther, output, cacheWrite, cacheRead, id: (payload && payload.message_id) || o.message_id };
}

async function collect(cx) {
  for (const root of dirs()) {
    const files = wireFiles(root);
    await mapLimit(files, 16, (file) =>
      cx.scanFile("kimi", root, file, async (out) => {
        await readJsonl(file, (o) => {
          const u = usageFrom(o);
          if (!u) return;
          out.add({
            source: "kimi",
            ts: o.timestamp != null ? o.timestamp : fs.statSync(file).mtime,
            model: o.model || "kimi-for-coding",
            provider: "moonshotai",
            session: path.basename(path.dirname(file)),
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

module.exports = { id: "kimi", label: "Kimi", collect };
