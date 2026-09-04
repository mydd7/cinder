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

async function collect(cacheDir, onProgress) {
  const cx = new Collector();
  cx.loadCache(cacheDir);
  let done = 0;
  let files = 0;
  let label = "";
  let lastPost = 0;
  const post = (force) => {
    if (!onProgress) return;
    const now = Date.now();
    if (!force && now - lastPost < 200) return;
    lastPost = now;
    onProgress({ done, total: SOURCES.length, label, files });
  };
  cx.onFile = () => {
    files++;
    post(false);
  };
  const errors = [];
  for (const source of SOURCES) {
    label = source.label;
    post(true);
    try {
      await source.collect(cx);
    } catch (err) {
      errors.push(source.label + ": " + String(err && err.message ? err.message : err));
    }
    done++;
  }
  label = "";
  post(true);
  cx.saveCache();
  const res = cx.result();
  res.catalog = CATALOG;
  if (errors.length) res.error = errors.join("; ");
  return res;
}

module.exports = { collect, CATALOG };
