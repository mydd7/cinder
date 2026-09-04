const fs = require("fs");
const path = require("path");
const { walk, envDirs, HOME } = require("../normalize");
const { queryLive, withLiveDb } = require("../sqlite");

const HASH_SQL =
  "SELECT requestId AS id, MAX(conversationId) AS session, MAX(model) AS model, MIN(createdAt) AS ts FROM ai_code_hashes WHERE requestId IS NOT NULL AND TRIM(requestId) != '' GROUP BY requestId";
const BUBBLE_SQL =
  "SELECT key, json_extract(value,'$.type') AS type, json_extract(value,'$.createdAt') AS createdAt, json_extract(value,'$.modelInfo.modelName') AS model, json_extract(value,'$.toolFormerData.name') AS toolName, json_extract(value,'$.toolFormerData.modelCallId') AS toolId FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'";
const COMPOSER_SQL =
  "SELECT key, json_extract(value,'$.createdAt') AS createdAt, json_extract(value,'$.modelConfig.modelName') AS model, json_extract(value,'$.name') AS name, json_extract(value,'$.isDraft') AS isDraft FROM cursorDiskKV WHERE key LIKE 'composerData:%'";

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

function userDirs() {
  const env = envDirs("CURSOR_DATA_DIR");
  if (env.length) return uniq(env);
  const appData = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
  const xdg = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  return uniq([
    path.join(appData, "Cursor", "User"),
    path.join(HOME, "Library", "Application Support", "Cursor", "User"),
    path.join(xdg, "Cursor", "User")
  ]).filter((d) => fs.existsSync(d));
}

function stateDbs() {
  const out = [];
  for (const user of userDirs()) {
    const global = path.join(user, "globalStorage", "state.vscdb");
    if (fs.existsSync(global)) out.push(global);
  }
  return uniq(out);
}

function trackingDbs() {
  const env = envDirs("CURSOR_TRACKING_DB");
  const files = [];
  for (const raw of env) {
    if (fs.existsSync(raw) && fs.statSync(raw).isFile()) files.push(raw);
    else {
      const p = path.join(raw, "ai-code-tracking.db");
      if (fs.existsSync(p)) files.push(p);
    }
  }
  if (files.length) return uniq(files);
  const p = path.join(HOME, ".cursor", "ai-tracking", "ai-code-tracking.db");
  return fs.existsSync(p) ? [p] : [];
}

function projectFromSlug(slug) {
  const parts = String(slug || "").split("-").filter(Boolean);
  if (!parts.length) return "cursor";
  const last = parts[parts.length - 1];
  if (/^[0-9a-f]{8,}$/i.test(last) && parts.length > 1) return parts[parts.length - 2];
  return last;
}

function convoProjects() {
  const map = new Map();
  const root = path.join(HOME, ".cursor", "projects");
  let slugs;
  try {
    slugs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return map;
  }
  for (const s of slugs) {
    if (!s.isDirectory()) continue;
    const project = projectFromSlug(s.name);
    const at = path.join(root, s.name, "agent-transcripts");
    let convos;
    try {
      convos = fs.readdirSync(at, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const c of convos) {
      if (c.isDirectory()) map.set(c.name, project);
    }
  }
  return map;
}

function modelName(raw) {
  const m = String(raw || "").trim();
  if (!m || m === "default") return "cursor-auto";
  return m;
}

function providerFor(model) {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (/^(gpt|o[1-4]|codex)/.test(m)) return "openai";
  if (m.startsWith("grok")) return "xai";
  if (m.startsWith("gemini") || m.startsWith("gemma")) return "google";
  return "cursor";
}

function emptyEntry(fields) {
  return {
    source: "cursor",
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
    allowEmpty: true,
    provider: providerFor(fields.model),
    ...fields
  };
}

function bubbleComposerId(key) {
  const rest = String(key || "").slice("bubbleId:".length);
  const cut = rest.indexOf(":");
  return cut > 0 ? rest.slice(0, cut) : rest;
}

async function collect(cx) {
  const projects = convoProjects();

  for (const db of trackingDbs()) {
    await cx.scanFile("cursor", path.dirname(db), db, async (out) => {
      const rows = await queryLive(db, HASH_SQL);
      if (!rows) throw new Error("sqlite unavailable");
      for (const r of rows) {
        if (!r.id) continue;
        out.add(
          emptyEntry({
            ts: r.ts,
            model: modelName(r.model),
            project: (r.session && projects.get(r.session)) || "cursor",
            session: r.session || String(r.id),
            dedup: "req:" + r.id
          })
        );
      }
    });
  }

  for (const db of stateDbs()) {
    await cx.scanFile("cursor", path.dirname(db), db, async (out) => {
      const { composers, bubbles } = await withLiveDb(db, async (query) => ({
        composers: await query(COMPOSER_SQL),
        bubbles: (await query(BUBBLE_SQL)) || []
      }));
      if (!composers) throw new Error("sqlite unavailable");
      const withBubbles = new Set();

      for (const r of bubbles) {
        if (Number(r.type) !== 1) continue;
        const composerId = bubbleComposerId(r.key);
        withBubbles.add(composerId);
        out.add(
          emptyEntry({
            ts: r.createdAt,
            model: modelName(r.model),
            project: projects.get(composerId) || "cursor",
            session: composerId || path.basename(db, ".vscdb"),
            dedup: "bubble:" + r.key
          })
        );
      }

      for (const r of composers) {
        const id = String(r.key || "").slice("composerData:".length);
        if (!id || withBubbles.has(id) || r.isDraft) continue;
        out.add(
          emptyEntry({
            ts: r.createdAt,
            model: modelName(r.model),
            project: projects.get(id) || projectFromSlug(r.name) || "cursor",
            session: id,
            dedup: "composer:" + id
          })
        );
      }
    });
  }
}

function transcriptFiles() {
  const root = path.join(HOME, ".cursor", "projects");
  const files = [];
  if (!fs.existsSync(root)) return files;
  walk(root, ".jsonl", (f) => {
    if (f.includes(`${path.sep}agent-transcripts${path.sep}`) || f.includes("/agent-transcripts/")) files.push(f);
  });
  return files;
}

const TOOL_ALIAS = {
  glob_file_search: "Glob",
  ripgrep_raw_search: "Grep",
  read_file_v2: "Read",
  read_file: "Read",
  edit_file_v2: "StrReplace",
  run_terminal_command_v2: "Shell",
  todo_write: "TodoWrite",
  read_lints: "ReadLints",
  task_v2: "Task",
  ask_question: "AskQuestion",
  create_plan: "CreatePlan",
  switch_mode: "SwitchMode",
  update_current_step: "UpdateCurrentStep",
  semantic_search_full: "SemanticSearch",
  await: "Await",
  rg: "Grep",
  ReadFile: "Read"
};

function toolName(raw) {
  const n = String(raw || "").trim();
  if (!n) return "";
  return TOOL_ALIAS[n] || TOOL_ALIAS[n.toLowerCase()] || n;
}

module.exports = {
  id: "cursor",
  label: "Cursor",
  collect,
  BUBBLE_SQL,
  userDirs,
  transcriptFiles,
  toolName
};
