const fs = require("fs");
const path = require("path");
const { num, HOME } = require("../normalize");
const { queryAll } = require("../sqlite");

const QUERY =
  "SELECT id, model, billing_provider, started_at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens, estimated_cost_usd, actual_cost_usd FROM sessions WHERE model IS NOT NULL AND TRIM(model) != ''";

function dbs() {
  const env = process.env.HERMES_HOME;
  const roots = env ? env.split(/[,;:]/).map((s) => s.trim()).filter(Boolean) : [path.join(HOME, ".hermes")];
  return [...new Set(roots)].map((r) => path.join(r, "state.db")).filter((p) => fs.existsSync(p));
}

function collect(cx) {
  for (const db of dbs()) {
    const rows = queryAll(db, QUERY);
    if (!rows) continue;
    let hits = 0;
    for (const r of rows) {
      const cost =
        typeof r.actual_cost_usd === "number"
          ? r.actual_cost_usd
          : typeof r.estimated_cost_usd === "number"
          ? r.estimated_cost_usd
          : undefined;
      const ok = cx.add({
        source: "hermes",
        ts: num(r.started_at),
        model: r.model,
        provider: r.billing_provider || "hermes",
        session: String(r.id),
        input: num(r.input_tokens),
        output: num(r.output_tokens),
        cacheWrite: num(r.cache_write_tokens),
        cacheRead: num(r.cache_read_tokens),
        reasoning: num(r.reasoning_tokens),
        cost,
        dedup: String(r.id)
      });
      if (ok) hits++;
    }
    if (hits > 0) cx.file("hermes", path.dirname(db));
  }
}

module.exports = { id: "hermes", label: "Hermes", collect };
