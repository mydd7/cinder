const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { num, walk, mapLimit, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("DROID_SESSIONS_DIR");
  const roots = env.length ? env : [path.join(HOME, ".factory", "sessions")];
  return [...new Set(roots)].filter((d) => fs.existsSync(d));
}

async function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".settings.json", (f) => files.push(f));
    await mapLimit(files, 16, (file) =>
      cx.scanFile("droid", dir, file, async (out) => {
        let s;
        try {
          s = JSON.parse(await fsp.readFile(file, "utf8"));
        } catch {
          return;
        }
        const u = s && s.tokenUsage;
        if (!u) return;
        let ts = s.providerLockTimestamp;
        if (!ts) {
          try {
            ts = fs.statSync(file).mtime;
          } catch {
            return;
          }
        }
        out.add({
          source: "droid",
          ts,
          model: s.model || s.providerLock || "droid",
          provider: s.providerLock || "droid",
          session: path.basename(file).replace(/\.settings\.json$/, ""),
          input: num(u.inputTokens),
          output: num(u.outputTokens),
          cacheWrite: num(u.cacheCreationTokens),
          cacheRead: num(u.cacheReadTokens),
          reasoning: num(u.thinkingTokens)
        });
      })
    );
  }
}

module.exports = { id: "droid", label: "Droid", collect };
