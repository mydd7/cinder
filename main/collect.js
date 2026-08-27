const { Collector } = require("./normalize");

const SOURCES = [
  require("./sources/claude"),
  require("./sources/codex"),
  require("./sources/opencode"),
  require("./sources/kilo"),
  require("./sources/goose"),
  require("./sources/hermes"),
  require("./sources/gemini"),
  require("./sources/qwen"),
  require("./sources/droid"),
  require("./sources/amp"),
  require("./sources/kimi"),
  require("./sources/codebuff"),
  require("./sources/openclaw"),
  require("./sources/pi"),
  require("./sources/copilot"),
  require("./sources/cursor"),
  require("./sources/antigravity")
];

const CATALOG = SOURCES.map((s) => ({ id: s.id, label: s.label }));

async function collect(cacheDir) {
  const cx = new Collector();
  cx.loadCache(cacheDir);
  for (const source of SOURCES) {
    try {
      await source.collect(cx);
    } catch {}
  }
  cx.saveCache();
  const res = cx.result();
  res.catalog = CATALOG;
  return res;
}

module.exports = { collect, CATALOG };
