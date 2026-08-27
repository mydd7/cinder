const fs = require("fs");
const path = require("path");
const { num, readJsonl, HOME, envDirs } = require("./normalize");
const { costParts } = require("./pricing");

const MAX_TEXT = 1200;
const MAX_MESSAGES = 300;

function claudeRoots() {
  const out = [];
  const push = (dir) => {
    if (dir && fs.existsSync(path.join(dir, "projects")) && !out.includes(dir)) out.push(path.join(dir, "projects"));
  };
  const env = envDirs("CLAUDE_CONFIG_DIR");
  if (env.length) {
    for (let raw of env) {
      if (path.basename(raw) === "projects") raw = path.dirname(raw);
      push(raw);
    }
    if (out.length) return out;
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  push(path.join(xdg, "claude"));
  push(path.join(HOME, ".claude"));
  return out;
}

function codexRoots() {
  const homes = envDirs("CODEX_HOME");
  const list = homes.length ? homes : [path.join(HOME, ".codex")];
  const out = [];
  for (const h of list) {
    for (const sub of ["sessions", "archived_sessions"]) {
      const d = path.join(h, sub);
      if (fs.existsSync(d) && !out.includes(d)) out.push(d);
    }
  }
  return out;
}

function findIn(dir, target) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const subdirs = [];
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) subdirs.push(path.join(dir, e.name));
    else if (e.name === target) return path.join(dir, e.name);
  }
  for (const sub of subdirs) {
    const hit = findIn(sub, target);
    if (hit) return hit;
  }
  return null;
}

const fileCache = new Map();

function findFile(roots, session) {
  const key = session;
  const cached = fileCache.get(key);
  if (cached && fs.existsSync(cached)) return cached;
  const target = session + ".jsonl";
  for (const root of roots) {
    const hit = findIn(root, target);
    if (hit) {
      fileCache.set(key, hit);
      return hit;
    }
  }
  return null;
}

function clip(text) {
  const t = String(text || "").trim();
  return t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + "…" : t;
}

const NOISE = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<local-command-[a-z-]+>[\s\S]*?<\/local-command-[a-z-]+>/g,
  /<command-(name|message|args)>[\s\S]*?<\/command-(name|message|args)>/g
];

function strip(text) {
  let out = String(text || "");
  for (const re of NOISE) out = out.replace(re, "");
  return out.trim();
}

const MAX_DETAIL = 400;

function toolDetail(input) {
  if (!input || typeof input !== "object") return "";
  const first = [input.command, input.file_path, input.path, input.pattern, input.url, input.query, input.prompt].find(
    (v) => typeof v === "string" && v.trim()
  );
  const detail = first || "";
  return detail.length > MAX_DETAIL ? detail.slice(0, MAX_DETAIL) + "…" : detail;
}

function claudeParts(content) {
  if (typeof content === "string") return { text: strip(content), tools: [], toolResults: 0 };
  if (!Array.isArray(content)) return { text: "", tools: [], toolResults: 0 };
  const parts = [];
  const tools = [];
  let toolResults = 0;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && block.text) parts.push(strip(block.text));
    else if (block.type === "thinking" && block.thinking) parts.push(strip(block.thinking));
    else if (block.type === "tool_use") tools.push({ name: block.name || "unknown", detail: toolDetail(block.input) });
    else if (block.type === "tool_result") toolResults++;
  }
  return { text: parts.filter(Boolean).join("\n\n"), tools, toolResults };
}

const MAX_GROUP_TEXT = 3000;

function groupTurns(messages) {
  const out = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (m.role !== "user" && last && last.role !== "user") {
      last.text = [last.text, m.text].filter(Boolean).join("\n\n").slice(0, MAX_GROUP_TEXT);
      last.tools = last.tools.concat(m.tools || []);
      last.input += m.input;
      last.output += m.output;
      last.cacheWrite += m.cacheWrite;
      last.cacheRead += m.cacheRead;
      last.cost += m.cost;
      if (m.model) last.model = m.model;
      continue;
    }
    out.push({ ...m, role: m.role === "user" ? "user" : "assistant", tools: [...(m.tools || [])] });
  }
  return out;
}

function costOfUsage(model, provider, usage, ts) {
  const parts = costParts(model, provider, usage, ts);
  return parts.input + parts.output + parts.cacheWrite + parts.cacheRead;
}

async function readClaude(file) {
  const messages = [];
  await readJsonl(file, (o) => {
    if (o.isMeta || o.isSidechain) return;
    if (o.type !== "user" && o.type !== "assistant") return;
    const msg = o.message;
    if (!msg || !msg.role) return;
    const { text, tools, toolResults } = claudeParts(msg.content);
    if (!text && toolResults && !tools.length) return;
    const u = msg.usage || {};
    const usage = {
      input: num(u.input_tokens),
      output: num(u.output_tokens),
      cacheWrite: num(u.cache_creation_input_tokens),
      cacheRead: num(u.cache_read_input_tokens)
    };
    const model = msg.model || "";
    const tokens = usage.input + usage.output + usage.cacheWrite + usage.cacheRead;
    if (!text && !tools.length) return;
    messages.push({
      role: msg.role,
      ts: o.timestamp || msg.timestamp || "",
      model,
      text: clip(text),
      tools,
      ...usage,
      cost:
        typeof o.costUSD === "number"
          ? o.costUSD
          : tokens
            ? costOfUsage(model, "anthropic", usage, o.timestamp)
            : 0
    });
  });
  return messages;
}

function codexText(payload) {
  const content = payload.content;
  if (typeof content === "string") return clip(content);
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      if (typeof block.text === "string") parts.push(block.text);
    }
    return clip(parts.join("\n\n"));
  }
  if (typeof payload.text === "string") return clip(payload.text);
  return "";
}

async function readCodex(file) {
  const messages = [];
  let model = "gpt-5";
  const prev = { input: 0, output: 0, cacheRead: 0 };
  let started = false;
  await readJsonl(file, (o) => {
    const p = o.payload;
    if (!p) return;
    if (o.type === "turn_context" || o.type === "session_meta") {
      if (p.model) model = p.model;
      return;
    }
    if (p.type === "message" && p.role) {
      const text = codexText(p);
      if (!text) return;
      messages.push({
        role: p.role,
        ts: o.timestamp || "",
        model,
        text,
        input: 0,
        output: 0,
        cacheWrite: 0,
        cacheRead: 0,
        cost: 0
      });
      return;
    }
    if (p.type === "function_call" || p.type === "custom_tool_call") {
      let args = p.arguments || p.input;
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          args = { command: args };
        }
      }
      messages.push({
        role: "tool",
        ts: o.timestamp || "",
        model,
        text: "",
        tools: [{ name: p.name || "unknown", detail: toolDetail(args) }],
        input: 0,
        output: 0,
        cacheWrite: 0,
        cacheRead: 0,
        cost: 0
      });
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
      const usage = { input: Math.max(0, dIn), output: Math.max(0, dOut), cacheWrite: 0, cacheRead: Math.max(0, dCr) };
      if (usage.input + usage.output + usage.cacheRead <= 0) return;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role !== "assistant") continue;
        messages[i].input = usage.input;
        messages[i].output = usage.output;
        messages[i].cacheRead = usage.cacheRead;
        messages[i].cost = costOfUsage(model, "openai", usage, o.timestamp);
        break;
      }
    }
  });
  return messages;
}

async function readTranscript(source, session) {
  if (!session) return { supported: false, messages: [] };
  let file = null;
  let read = null;
  if (source === "claude") {
    file = findFile(claudeRoots(), session);
    read = readClaude;
  } else if (source === "codex") {
    file = findFile(codexRoots(), session);
    read = readCodex;
  } else {
    return { supported: false, messages: [] };
  }
  if (!file) return { supported: true, messages: [], error: "Session file not found" };
  const messages = groupTurns(await read(file));
  return { supported: true, file, total: messages.length, messages: messages.slice(0, MAX_MESSAGES) };
}

module.exports = { readTranscript };
