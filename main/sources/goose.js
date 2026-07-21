const fs = require("fs");
const path = require("path");
const { num, HOME } = require("../normalize");
const { queryAll } = require("../sqlite");

const QUERY =
  "SELECT id, model_config_json, provider_name, created_at, total_tokens, input_tokens, output_tokens, accumulated_total_tokens, accumulated_input_tokens, accumulated_output_tokens FROM sessions WHERE model_config_json IS NOT NULL AND TRIM(model_config_json) != ''";

function dbs() {
  const root = process.env.GOOSE_PATH_ROOT;
  const candidates = root
    ? [path.join(root, "data", "sessions", "sessions.db")]
    : [
        path.join(HOME, ".local", "share", "goose", "sessions", "sessions.db"),
        path.join(HOME, "Library", "Application Support", "goose", "sessions", "sessions.db"),
        path.join(HOME, ".local", "share", "Block", "goose", "sessions", "sessions.db")
      ];
  return candidates.filter((p) => fs.existsSync(p));
}

function modelName(json) {
  try {
    const c = JSON.parse(json);
    return c.model_name || c.model || "unknown";
  } catch {
    return "unknown";
  }
}

function collect(cx) {
  for (const db of dbs()) {
    const rows = queryAll(db, QUERY);
    if (!rows) continue;
    let hits = 0;
    for (const r of rows) {
      const input = num(r.accumulated_input_tokens) || num(r.input_tokens);
      const output = num(r.accumulated_output_tokens) || num(r.output_tokens);
      const total = num(r.accumulated_total_tokens) || num(r.total_tokens) || input + output;
      const reasoning = Math.max(0, total - input - output);
      const model = modelName(r.model_config_json);
      const ok = cx.add({
        source: "goose",
        ts: r.created_at,
        model,
        provider: r.provider_name || "goose",
        session: String(r.id),
        input,
        output,
        cacheWrite: 0,
        cacheRead: 0,
        reasoning,
        dedup: String(r.id)
      });
      if (ok) hits++;
    }
    if (hits > 0) cx.file("goose", path.dirname(db));
  }
}

module.exports = { id: "goose", label: "Goose", collect };
