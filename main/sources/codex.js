const fs = require("fs");
const path = require("path");
const { num, walk, readJsonl, mapLimit, envDirs, HOME } = require("../normalize");

function homes() {
  const env = envDirs("CODEX_HOME");
  const list = env.length ? env : [path.join(HOME, ".codex")];
  return [...new Set(list)];
}

function dirs() {
  const out = [];
  for (const h of homes()) {
    for (const sub of ["sessions", "archived_sessions"]) {
      const d = path.join(h, sub);
      if (fs.existsSync(d)) out.push(d);
    }
  }
  return [...new Set(out)];
}

const KEEP = (line) =>
  line.includes('"token_count"') || line.includes('"turn_context"') || line.includes('"session_meta"');

async function readFile(file, out) {
  let model = "gpt-5";
  let cwd = null;
  const prev = { input: 0, output: 0, cacheRead: 0 };
  let started = false;
  await readJsonl(file, (o) => {
    const p = o.payload;
    if (!p) return;
    if (o.type === "turn_context" || o.type === "session_meta") {
      if (p.model) model = p.model;
      if (p.cwd) cwd = p.cwd;
      return;
    }
    if (o.type === "event_msg" && p.type === "token_count" && p.info && p.info.total_token_usage) {
      const u = p.info.total_token_usage;
      const totIn = num(u.input_tokens) - num(u.cached_input_tokens);
      const totOut = num(u.output_tokens);
      const totCr = num(u.cached_input_tokens);
      let dIn = totIn - prev.input;
      let dOut = totOut - prev.output;
      let dCr = totCr - prev.cacheRead;
      if (!started || dIn < 0 || dOut < 0 || dCr < 0) {
        dIn = totIn;
        dOut = totOut;
        dCr = totCr;
      }
      prev.input = totIn;
      prev.output = totOut;
      prev.cacheRead = totCr;
      started = true;
      if (dIn + dOut + dCr <= 0) return;
      out.add({
        source: "codex",
        ts: o.timestamp,
        model,
        provider: "openai",
        project: cwd ? path.basename(cwd) : path.basename(file, ".jsonl"),
        session: path.basename(file, ".jsonl"),
        input: Math.max(0, dIn),
        output: Math.max(0, dOut),
        cacheWrite: 0,
        cacheRead: Math.max(0, dCr)
      });
    }
  }, KEEP);
}

async function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 16, (file) => cx.scanFile("codex", dir, file, (out) => readFile(file, out)));
  }
}

module.exports = { id: "codex", label: "Codex", collect };
