const fs = require("fs");
const path = require("path");
const { num, walk, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("DROID_SESSIONS_DIR");
  const roots = env.length ? env : [path.join(HOME, ".factory", "sessions")];
  return [...new Set(roots)].filter((d) => fs.existsSync(d));
}

function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".settings.json", (f) => files.push(f));
    let hits = 0;
    for (const file of files) {
      let s;
      try {
        s = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      const u = s && s.tokenUsage;
      if (!u) continue;
      let ts = s.providerLockTimestamp;
      if (!ts) {
        try {
          ts = fs.statSync(file).mtime;
        } catch {
          continue;
        }
      }
      const ok = cx.add({
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
      if (ok) hits++;
    }
    if (hits > 0) cx.file("droid", dir);
  }
}

module.exports = { id: "droid", label: "Droid", collect };
