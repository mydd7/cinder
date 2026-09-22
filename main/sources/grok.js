const fs = require("fs");
const path = require("path");
const { num, mapLimit, envDirs, HOME } = require("../normalize");

const SKIP = new Set(["terminal", "compaction", "compaction_checkpoints", "recap_requests"]);

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

function homes() {
  const env = envDirs("GROK_HOME");
  if (env.length) return uniq(env);
  const xdg = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  const appData = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
  const local = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
  return uniq([
    path.join(HOME, ".grok"),
    path.join(xdg, "grok"),
    path.join(HOME, "Library", "Application Support", "Grok"),
    path.join(appData, "Grok"),
    path.join(local, "Grok")
  ]).filter((d) => fs.existsSync(d));
}

function pushSession(out, dir) {
  if (!dir || SKIP.has(path.basename(dir))) return;
  if (fs.existsSync(path.join(dir, "usage.json")) || fs.existsSync(path.join(dir, "summary.json"))) {
    out.push(dir);
  }
}

function sessionFolders() {
  const out = [];
  for (const home of homes()) {
    const root = path.join(home, "sessions");
    let workspaces;
    try {
      workspaces = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const w of workspaces) {
      if (!w.isDirectory()) continue;
      const wp = path.join(root, w.name);
      pushSession(out, wp);
      let kids;
      try {
        kids = fs.readdirSync(wp, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const k of kids) {
        if (k.isDirectory()) pushSession(out, path.join(wp, k.name));
      }
    }
  }
  return uniq(out);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function projectName(summary, sessionDir) {
  const cwd = summary && summary.info && summary.info.cwd;
  if (cwd) {
    const base = path.basename(String(cwd).replace(/[\\/]+$/, ""));
    if (base) return base;
  }
  const parent = path.basename(path.dirname(sessionDir));
  try {
    const decoded = decodeURIComponent(parent);
    return path.basename(decoded.replace(/[\\/]+$/, "")) || "grok";
  } catch {
    return parent || "grok";
  }
}

function modelName(raw) {
  const m = String(raw || "").trim();
  if (!m) return "grok";
  return m.replace(/-build$/, "");
}

function splitUsage(u) {
  if (!u || typeof u !== "object") return null;
  const cacheRead = num(u.cachedReadTokens);
  const cacheWrite = num(u.cacheCreationTokens);
  const inputTotal = num(u.inputTokens);
  const input = Math.max(0, inputTotal - cacheRead - cacheWrite);
  const output = num(u.outputTokens);
  const reasoning = num(u.reasoningTokens);
  if (input + output + cacheRead + cacheWrite + reasoning === 0) return null;
  return { input, output, cacheWrite, cacheRead, reasoning };
}

function addChunk(out, fields, u) {
  const usage = splitUsage(u);
  if (!usage) return;
  out.add({
    source: "grok",
    provider: "xai",
    ...fields,
    ...usage
  });
}

async function collect(cx) {
  const folders = sessionFolders();
  await mapLimit(folders, 16, (dir) => {
    const file = path.join(dir, "usage.json");
    if (!fs.existsSync(file)) return Promise.resolve();
    const scanDir = path.dirname(path.dirname(dir));
    return cx.scanFile("grok", scanDir, file, async (out) => {
      const usage = readJson(file);
      if (!usage) return;
      const summary = readJson(path.join(dir, "summary.json")) || {};
      const session = usage.sessionId || path.basename(dir);
      const project = projectName(summary, dir);
      const fallbackTs = usage.updatedAt || summary.updated_at || summary.created_at;
      const turns = Array.isArray(usage.turns) ? usage.turns : [];
      if (turns.length) {
        for (const turn of turns) {
          addChunk(
            out,
            {
              ts: turn.endedAt || fallbackTs,
              model: modelName(
                turn.primaryModelId || (usage.session && usage.session.primaryModelId) || summary.current_model_id
              ),
              project,
              session,
              dedup: session + ":t" + String(turn.turnNumber != null ? turn.turnNumber : "")
            },
            turn
          );
        }
        return;
      }
      addChunk(
        out,
        {
          ts: fallbackTs,
          model: modelName((usage.session && usage.session.primaryModelId) || summary.current_model_id),
          project,
          session,
          dedup: session
        },
        usage.session
      );
    });
  });
}

function updatesFiles() {
  return sessionFolders()
    .map((dir) => path.join(dir, "updates.jsonl"))
    .filter((f) => fs.existsSync(f));
}

function KEEP(line) {
  if (line.includes("tool_call_update")) return false;
  return (
    line.includes('"sessionUpdate":"tool_call"') ||
    line.includes('"sessionUpdate": "tool_call"') ||
    line.includes("displayAsSkill")
  );
}

function eventTs(o) {
  let ts = Number(o && o.timestamp);
  if (isFinite(ts) && ts > 0 && ts < 1e12) ts *= 1000;
  if (!isFinite(ts) || ts <= 0) ts = 0;
  return ts;
}

function eventFromUpdate(o) {
  const u = o && o.params && o.params.update;
  if (!u) return null;
  const ts = eventTs(o);
  const eventId = o.params._meta && o.params._meta.eventId;

  if (u.sessionUpdate === "user_message_chunk") {
    const c = u.content;
    const meta = c && c._meta;
    if (!meta || !meta.displayAsSkill) return null;
    const raw = String(meta.displayText || c.text || "").trim();
    const n = raw.replace(/^\//, "");
    if (!n) return null;
    return { i: eventId != null ? String(eventId) : null, t: ts, k: "skill", n };
  }

  if (u.sessionUpdate !== "tool_call") return null;
  const meta = (u._meta && u._meta["x.ai/tool"]) || {};
  const name = String(meta.name || u.title || "").trim();
  if (!name) return null;
  const id = u.toolCallId != null ? String(u.toolCallId) : eventId != null ? String(eventId) : null;
  if (name === "use_tool") {
    const input = u.rawInput && typeof u.rawInput === "object" ? u.rawInput : {};
    const raw = String(input.tool_name || input.tool || "").trim();
    if (!raw) return { i: id, t: ts, k: "tool", n: name };
    const cut = raw.indexOf("__");
    if (cut > 0) return { i: id, t: ts, k: "mcp", s: raw.slice(0, cut), n: raw.slice(cut + 2) };
    return { i: id, t: ts, k: "tool", n: raw };
  }
  return { i: id, t: ts, k: "tool", n: name };
}

function mcpNames() {
  const names = new Set();
  const re = /^\s*\[mcp_servers\.([^"\].\]]+)\]/gm;
  for (const home of homes()) {
    const p = path.join(home, "config.toml");
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, "utf8");
      let m;
      while ((m = re.exec(raw))) names.add(m[1]);
    } catch {}
  }
  return [...names].sort();
}

module.exports = {
  id: "grok",
  label: "Grok",
  collect,
  homes,
  updatesFiles,
  KEEP,
  eventFromUpdate,
  splitUsage,
  modelName,
  mcpNames
};
