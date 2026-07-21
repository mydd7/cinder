const { num } = require("../normalize");

function parseMessage(d, opts) {
  if (!d || d.role !== "assistant" || !d.tokens) return null;
  const tk = d.tokens;
  const cache = tk.cache || {};
  const input = num(tk.input);
  const output = num(tk.output);
  const reasoning = num(tk.reasoning);
  const cacheWrite = num(cache.write);
  const cacheRead = num(cache.read);
  if (input + output + reasoning + cacheWrite + cacheRead === 0) return null;
  const t = d.time || {};
  const created = t.created != null ? t.created : t.completed != null ? t.completed : null;
  if (created == null) return null;
  return {
    source: opts.source,
    ts: created,
    model: d.modelID || d.model || "unknown",
    provider: d.providerID || opts.source,
    project: opts.project || opts.source,
    session: d.sessionID || opts.session || opts.source,
    input,
    output,
    reasoning,
    cacheWrite,
    cacheRead,
    cost: typeof d.cost === "number" ? d.cost : undefined,
    dedup: d.id || undefined
  };
}

module.exports = { parseMessage };
