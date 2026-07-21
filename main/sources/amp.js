const fs = require("fs");
const path = require("path");
const { num, walk, envDirs, HOME } = require("../normalize");

function dirs() {
  const env = envDirs("AMP_DATA_DIR");
  const roots = env.length ? env : [path.join(HOME, ".local", "share", "amp")];
  return [...new Set(roots)].filter((d) => fs.existsSync(d));
}

function cacheByMessage(messages) {
  const map = new Map();
  for (const m of messages || []) {
    const id = m.message_id || m.messageId || m.id;
    const u = m.usage;
    if (id != null && u) map.set(String(id), { cw: num(u.cacheCreationInputTokens), cr: num(u.cacheReadInputTokens) });
  }
  return map;
}

function fromThread(thread, threadId, cx) {
  const messages = thread.messages || [];
  const ledger = thread.usage_ledger && thread.usage_ledger.events;
  let hits = 0;
  if (Array.isArray(ledger)) {
    const cache = cacheByMessage(messages);
    for (const ev of ledger) {
      if (!ev.timestamp || !ev.model || !ev.tokens) continue;
      const c = cache.get(String(ev.to_message_id || ev.toMessageId)) || { cw: 0, cr: 0 };
      const ok = cx.add({
        source: "amp",
        ts: ev.timestamp,
        model: ev.model,
        provider: "amp",
        session: threadId,
        input: num(ev.tokens.input),
        output: num(ev.tokens.output),
        cacheWrite: c.cw,
        cacheRead: c.cr,
        dedup: ev.id != null ? String(ev.id) : undefined
      });
      if (ok) hits++;
    }
    return hits;
  }
  for (const m of messages) {
    if (!m.usage) continue;
    const u = m.usage;
    const ok = cx.add({
      source: "amp",
      ts: m.timestamp,
      model: m.model || "amp",
      provider: "amp",
      session: threadId,
      input: num(u.inputTokens),
      output: num(u.outputTokens),
      cacheWrite: num(u.cacheCreationInputTokens),
      cacheRead: num(u.cacheReadInputTokens),
      dedup: (m.message_id || m.messageId || m.id) != null ? String(m.message_id || m.messageId || m.id) : undefined
    });
    if (ok) hits++;
  }
  return hits;
}

function collect(cx) {
  for (const dir of dirs()) {
    const files = [];
    walk(dir, ".json", (f) => files.push(f));
    let hits = 0;
    for (const file of files) {
      let thread;
      try {
        thread = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      if (!thread || !thread.id || !Array.isArray(thread.messages)) continue;
      hits += fromThread(thread, String(thread.id), cx);
    }
    if (hits > 0) cx.file("amp", dir);
  }
}

module.exports = { id: "amp", label: "Amp", collect };
