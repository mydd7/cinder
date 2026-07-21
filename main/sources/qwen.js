const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { num, mapLimit, envDirs, HOME } = require("../normalize");

function chatFiles() {
  const env = envDirs("QWEN_DATA_DIR");
  const roots = env.length ? env : [path.join(HOME, ".qwen")];
  const out = [];
  for (const root of [...new Set(roots)]) {
    const projects = path.join(root, "projects");
    if (!fs.existsSync(projects)) continue;
    walkChats(projects, out);
  }
  return out;
}

function walkChats(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkChats(full, out);
    else if (e.isFile() && e.name.endsWith(".jsonl") && path.basename(path.dirname(full)) === "chats") out.push(full);
  }
}

function pick(o, keys) {
  for (const k of keys) if (o[k] != null) return num(o[k]);
  return 0;
}

async function collect(cx) {
  const files = chatFiles();
  await mapLimit(files, 16, (file) =>
    cx.scanFile("qwen", path.dirname(file), file, async (out) => {
      let raw;
      try {
        raw = await fsp.readFile(file, "utf8");
      } catch {
        return;
      }
      for (const line of raw.split(/\r?\n/)) {
        if (!line.includes("usageMetadata") && !line.includes("usage_metadata")) continue;
        let o;
        try {
          o = JSON.parse(line);
        } catch {
          continue;
        }
        const m = o.usageMetadata || o.usage_metadata;
        if (!m) continue;
        const input = pick(m, ["promptTokenCount", "prompt_token_count"]);
        const output = pick(m, ["candidatesTokenCount", "candidates_token_count"]);
        const reasoning = pick(m, ["thoughtsTokenCount", "thoughts_token_count"]);
        const cacheRead = pick(m, ["cachedContentTokenCount", "cached_content_token_count"]);
        out.add({
          source: "qwen",
          ts: o.timestamp || o.created_at,
          model: o.model || "qwen",
          provider: "qwen",
          project: path.basename(path.dirname(path.dirname(file))),
          session: o.sessionId || o.session_id || path.basename(file, ".jsonl"),
          input,
          output,
          cacheWrite: 0,
          cacheRead,
          reasoning,
          dedup: o.id || o.messageId || undefined
        });
      }
    })
  );
}

module.exports = { id: "qwen", label: "Qwen", collect };
