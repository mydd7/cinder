const fs = require("fs");
const path = require("path");
const { num, walk, HOME } = require("../normalize");

function files() {
  const out = [];
  const otel = path.join(HOME, ".copilot", "otel");
  if (fs.existsSync(otel)) walk(otel, ".jsonl", (f) => out.push(f));
  const exp = process.env.COPILOT_OTEL_FILE_EXPORTER_PATH;
  if (exp && fs.existsSync(exp) && fs.statSync(exp).isFile()) out.push(exp);
  return [...new Set(out)];
}

const MODEL_ATTRS = ["gen_ai.request.model", "gen_ai.response.model", "gen_ai.model", "llm.model_name"];
const SESSION_ATTRS = ["gen_ai.conversation.id", "session.id", "session_id", "conversation.id"];

function attrNum(a, ...keys) {
  for (const k of keys) if (a[k] != null) return num(a[k]);
  return 0;
}
function attrStr(a, keys) {
  for (const k of keys) if (a[k] != null && String(a[k]).trim()) return String(a[k]);
  return null;
}

function tsOf(r) {
  if (r.time != null) return r.time;
  if (r.timestamp != null) return r.timestamp;
  if (r.observed_timestamp != null) return r.observed_timestamp;
  if (r.observedTimestamp != null) return r.observedTimestamp;
  if (r.time_unix_nano != null) return Number(r.time_unix_nano) / 1e6;
  if (r.timeUnixNano != null) return Number(r.timeUnixNano) / 1e6;
  return null;
}

function collect(cx) {
  for (const file of files()) {
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const records = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line.includes("attributes")) continue;
      try {
        records.push(JSON.parse(line));
      } catch {}
    }
    const ctx = new Map();
    for (const r of records) {
      const a = r.attributes;
      if (!a) continue;
      const trace = r.trace_id || r.traceId || (r.span_context && r.span_context.trace_id);
      if (trace == null) continue;
      const key = String(trace);
      const cur = ctx.get(key) || {};
      cur.model = cur.model || attrStr(a, MODEL_ATTRS);
      cur.session = cur.session || attrStr(a, SESSION_ATTRS);
      ctx.set(key, cur);
    }
    let hits = 0;
    let mtime = null;
    try {
      mtime = fs.statSync(file).mtime;
    } catch {}
    for (const r of records) {
      const a = r.attributes;
      if (!a) continue;
      const input = attrNum(a, "gen_ai.usage.input_tokens");
      const output = attrNum(a, "gen_ai.usage.output_tokens");
      if (input + output === 0) continue;
      const cacheRead = attrNum(a, "gen_ai.usage.cache_read.input_tokens");
      const cacheWrite = attrNum(a, "gen_ai.usage.cache_write.input_tokens", "gen_ai.usage.cache_creation.input_tokens");
      const reasoning = attrNum(a, "gen_ai.usage.reasoning.output_tokens", "gen_ai.usage.reasoning_tokens");
      const trace = r.trace_id || r.traceId || (r.span_context && r.span_context.trace_id);
      const c = (trace != null && ctx.get(String(trace))) || {};
      const responseId = attrStr(a, ["gen_ai.response.id", "response_id"]);
      const ok = cx.add({
        source: "copilot",
        ts: tsOf(r) || mtime,
        model: attrStr(a, MODEL_ATTRS) || c.model || "copilot",
        provider: "github-copilot",
        session: attrStr(a, SESSION_ATTRS) || c.session || path.basename(file, ".jsonl"),
        input,
        output,
        cacheWrite,
        cacheRead,
        reasoning,
        dedup: responseId || (trace != null ? String(trace) + ":" + (tsOf(r) || "") : undefined)
      });
      if (ok) hits++;
    }
    if (hits > 0) cx.file("copilot", path.dirname(file));
  }
}

module.exports = { id: "copilot", label: "GitHub Copilot", collect };
