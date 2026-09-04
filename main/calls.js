const fs = require("fs");
const path = require("path");
const { walk, readJsonl, mapLimit, envDirs, HOME } = require("./normalize");
const { writeJsonFile } = require("./jsonfile");
const { queryAll, queryLive } = require("./sqlite");
const cursorSrc = require("./sources/cursor");

const CLAUDE_KEEP = (line) => line.includes('"tool_use"');
const CODEX_KEEP = (line) =>
  line.includes('"function_call"') || line.includes('"custom_tool_call"') || line.includes('"McpToolCall"');

const SKILL_RE = /[/\\]skills[/\\]([^"'`\s\\/:*?<>|]+)/i;

function dayKeyOf(ms) {
  const d = new Date(ms);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

class CallScan {
  constructor() {
    this.cacheIn = {};
    this.cacheOut = {};
    this.cachePath = null;
    this.seen = new Set();
    this.acc = new Map();
  }

  loadCache(dir) {
    if (!dir) return;
    this.cachePath = path.join(dir, "calls-cache.json");
    try {
      const raw = JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
      if (raw && raw.v === 2 && raw.files) this.cacheIn = raw.files;
    } catch {}
  }

  saveCache() {
    if (!this.cachePath) return;
    try {
      writeJsonFile(this.cachePath, { v: 2, files: this.cacheOut });
    } catch {}
  }

  group(source) {
    let g = this.acc.get(source);
    if (!g) {
      g = { source, tools: new Map(), mcpTools: new Map(), skills: new Map(), byDay: new Map(), total: 0 };
      this.acc.set(source, g);
    }
    return g;
  }

  bump(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  async file(source, key, extractFn) {
    let st;
    try {
      st = fs.statSync(key);
    } catch {
      return;
    }
    const sig = st.mtimeMs + ":" + st.size;
    const cached = this.cacheIn[key];
    let raws;
    if (cached && cached.sig === sig) {
      raws = cached.e;
    } else {
      raws = [];
      try {
        await extractFn({ add: (ev) => raws.push(ev) });
      } catch {
        return;
      }
    }
    this.cacheOut[key] = { sig, e: raws };
    const g = this.group(source);
    for (const ev of raws) {
      if (!ev || !ev.k || !ev.n) continue;
      if (ev.i != null && ev.i !== "") {
        const id = source + ":" + ev.i;
        if (this.seen.has(id)) continue;
        this.seen.add(id);
      }
      g.total += 1;
      if (ev.t) this.bump(g.byDay, dayKeyOf(ev.t));
      if (ev.k === "tool") this.bump(g.tools, ev.n);
      else if (ev.k === "skill") this.bump(g.skills, ev.n);
      else if (ev.k === "mcp") this.bump(g.mcpTools, (ev.s || "unknown") + "\u0000" + ev.n);
    }
  }

  result() {
    const sources = {};
    for (const [source, g] of this.acc) {
      if (!g.total) continue;
      const mcpTools = [];
      const servers = new Map();
      for (const [tk, count] of g.mcpTools) {
        const cut = tk.indexOf("\u0000");
        const server = tk.slice(0, cut);
        mcpTools.push({ server, name: tk.slice(cut + 1), count });
        servers.set(server, (servers.get(server) || 0) + count);
      }
      sources[source] = {
        total: g.total,
        tools: [...g.tools].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        mcpTools: mcpTools.sort((a, b) => b.count - a.count),
        mcpServers: [...servers].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        skills: [...g.skills].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        byDay: Object.fromEntries([...g.byDay].sort())
      };
    }
    return sources;
  }
}

function claudeRoots() {
  const out = [];
  const push = (dir) => {
    if (dir && fs.existsSync(path.join(dir, "projects")) && !out.includes(dir)) out.push(dir);
  };
  const env = envDirs("CLAUDE_CONFIG_DIR");
  for (let raw of env) {
    if (path.basename(raw) === "projects") raw = path.dirname(raw);
    push(raw);
  }
  if (out.length) return out;
  const xdg = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  push(path.join(xdg, "claude"));
  push(path.join(HOME, ".claude"));
  return out;
}

function claudeConfigRoots() {
  const env = envDirs("CLAUDE_CONFIG_DIR").map((raw) =>
    path.basename(raw) === "projects" ? path.dirname(raw) : raw
  );
  const list = env.length ? env : [process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, "claude") : null, path.join(HOME, ".claude")];
  return [...new Set(list)].filter(Boolean);
}

async function collectClaude(scan) {
  for (const root of claudeRoots()) {
    const dir = path.join(root, "projects");
    const files = [];
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 16, (file) =>
      scan.file("claude", file, async (out) => {
        await readJsonl(file, (o) => {
          const msg = o && o.message;
          if (!msg || !Array.isArray(msg.content)) return;
          let ts = Date.parse(o.timestamp || msg.timestamp || "");
          if (isNaN(ts)) ts = 0;
          for (const c of msg.content) {
            if (!c || c.type !== "tool_use" || !c.name) continue;
            const name = String(c.name);
            const input = c.input && typeof c.input === "object" ? c.input : {};
            if (name.startsWith("mcp__")) {
              const rest = name.slice(5);
              const cut = rest.indexOf("__");
              out.add({ i: c.id, t: ts, k: "mcp", s: cut > 0 ? rest.slice(0, cut) : rest, n: cut > 0 ? rest.slice(cut + 2) : rest });
            } else if (name === "Skill") {
              out.add({ i: c.id, t: ts, k: "skill", n: String(input.skill || input.command || input.name || "unknown") });
            } else if (name === "SlashCommand") {
              out.add({ i: c.id, t: ts, k: "skill", n: String(input.command || "unknown") });
            } else {
              out.add({ i: c.id, t: ts, k: "tool", n: name });
            }
          }
        }, CLAUDE_KEEP);
      })
    );
  }
}

function codexDirs() {
  const env = envDirs("CODEX_HOME");
  const homes = env.length ? env : [path.join(HOME, ".codex")];
  const out = [];
  for (const h of [...new Set(homes)]) {
    for (const sub of ["sessions", "archived_sessions"]) {
      const d = path.join(h, sub);
      if (fs.existsSync(d)) out.push(d);
    }
  }
  return out;
}

async function collectCodex(scan) {
  for (const dir of codexDirs()) {
    const files = [];
    walk(dir, ".jsonl", (f) => files.push(f));
    await mapLimit(files, 8, (file) =>
      scan.file("codex", file, async (out) => {
        await readJsonl(file, (o) => {
          const p = o && o.payload;
          if (!p) return;
          let ts = Date.parse(o.timestamp || "");
          if (isNaN(ts)) ts = 0;
          if ((p.type === "function_call" || p.type === "custom_tool_call") && typeof p.name === "string") {
            const name = p.name;
            if (!name) return;
            const id = p.id != null ? String(p.id) : null;
            if (name.includes("__")) {
              const cut = name.indexOf("__");
              out.add({ i: id, t: ts, k: "mcp", s: name.slice(0, cut), n: name.slice(cut + 2) });
            } else {
              out.add({ i: id, t: ts, k: "tool", n: name });
            }
            const args = typeof p.arguments === "string" ? p.arguments : typeof p.input === "string" ? p.input : "";
            if (args.includes("SKILL.md")) {
              const m = args.match(SKILL_RE);
              if (m) out.add({ i: id ? id + ":sk" : null, t: ts, k: "skill", n: m[1] });
            }
            return;
          }
          if (p.type === "item_completed" && p.item && p.item.type === "McpToolCall") {
            const it = p.item;
            const server = typeof it.server === "string" ? it.server : "";
            const tool = typeof it.tool === "string" ? it.tool : "";
            if (server && tool) out.add({ i: it.id != null ? String(it.id) : null, t: ts, k: "mcp", s: server, n: tool });
          }
        }, CODEX_KEEP);
      })
    );
  }
}

function opencodeDbs() {
  const env = envDirs("OPENCODE_DATA_DIR");
  const dirs = env.length
    ? [...new Set(env)]
    : [
        process.env.XDG_DATA_HOME ? path.join(process.env.XDG_DATA_HOME, "opencode") : null,
        path.join(HOME, ".local", "share", "opencode"),
        process.env.APPDATA ? path.join(process.env.APPDATA, "opencode") : null,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "opencode") : null,
        path.join(HOME, "Library", "Application Support", "opencode"),
        path.join(HOME, ".opencode")
      ].filter(Boolean);
  const out = [];
  for (const dir of [...new Set(dirs)]) {
    const primary = path.join(dir, "opencode.db");
    if (fs.existsSync(primary)) out.push(primary);
    try {
      for (const name of fs.readdirSync(dir)) {
        if (/^opencode-[\w.-]+\.db$/.test(name)) {
          const p = path.join(dir, name);
          if (!out.includes(p)) out.push(p);
        }
      }
    } catch {}
  }
  return out;
}

function jsonBlockKeys(raw, key) {
  const head = new RegExp('["\']' + key + '["\']\\s*:\\s*\\{').exec(raw);
  if (!head) return [];
  let i = head.index + head[0].length;
  let depth = 1;
  const start = i;
  while (i < raw.length && depth > 0) {
    const ch = raw[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < raw.length && raw[i] !== q) {
        if (raw[i] === "\\") i++;
        i++;
      }
    } else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  const body = raw.slice(start, Math.max(start, i - 1));
  const keys = [];
  let j = 0;
  let inner = 0;
  while (j < body.length) {
    const ch = body[j];
    if (ch === '"' || ch === "'") {
      const q = ch;
      const ks = ++j;
      while (j < body.length && body[j] !== q) {
        if (body[j] === "\\") j++;
        j++;
      }
      const val = body.slice(ks, j);
      j++;
      let k = j;
      while (k < body.length && /\s/.test(body[k])) k++;
      if (body[k] === ":" && inner === 0 && val.trim()) keys.push(val.trim());
    } else if (ch === "{" || ch === "[") {
      inner++;
      j++;
    } else if (ch === "}" || ch === "]") {
      inner--;
      j++;
    } else j++;
  }
  return keys;
}

const CURSOR_MCP_TOOLS = new Set(["CallMcpTool", "call_mcp_tool"]);

async function collectCursor(scan) {
  const files = cursorSrc.transcriptFiles();
  await mapLimit(files, 8, (file) =>
    scan.file("cursor", file, async (out) => {
      let mtime = 0;
      try {
        mtime = fs.statSync(file).mtimeMs;
      } catch {}
      await readJsonl(file, (o) => {
        const msg = o && o.message;
        const content = msg && msg.content;
        if (!Array.isArray(content)) return;
        for (const c of content) {
          if (!c || c.type !== "tool_use" || !c.name) continue;
          const name = String(c.name);
          const id = c.id != null ? String(c.id) : null;
          const input = c.input && typeof c.input === "object" ? c.input : {};
          if (CURSOR_MCP_TOOLS.has(name)) {
            const server = String(input.server || input.serverName || input.mcpServer || "unknown");
            const tool = String(input.toolName || input.tool || input.name || name);
            out.add({ i: id, t: mtime, k: "mcp", s: server, n: tool });
          } else {
            out.add({ i: id, t: mtime, k: "tool", n: cursorSrc.toolName(name) });
          }
        }
      }, CLAUDE_KEEP);
    })
  );

  for (const user of cursorSrc.userDirs()) {
    const db = path.join(user, "globalStorage", "state.vscdb");
    if (!fs.existsSync(db)) continue;
    await scan.file("cursor", db, async (out) => {
      const rows = await queryLive(db, cursorSrc.BUBBLE_SQL);
      if (!rows) throw new Error("sqlite unavailable");
      for (const r of rows) {
        if (Number(r.type) !== 2 || !r.toolName) continue;
        let ts = Date.parse(r.createdAt);
        if (isNaN(ts)) ts = Number(r.createdAt);
        if (!isFinite(ts) || ts <= 0) ts = 0;
        out.add({
          i: r.toolId != null ? String(r.toolId) : r.key,
          t: ts,
          k: "tool",
          n: cursorSrc.toolName(r.toolName)
        });
      }
    });
  }
}

function cursorMcpNames() {
  const p = path.join(HOME, ".cursor", "mcp.json");
  if (!fs.existsSync(p)) return [];
  try {
    const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
    return Object.keys(cfg.mcpServers || {}).sort();
  } catch {
    return [];
  }
}

function opencodeMcpNames() {
  const roots = [
    process.env.XDG_CONFIG_HOME ? path.join(process.env.XDG_CONFIG_HOME, "opencode") : null,
    path.join(HOME, ".config", "opencode")
  ].filter(Boolean);
  for (const root of [...new Set(roots)]) {
    for (const f of ["opencode.json", "opencode.jsonc"]) {
      const p = path.join(root, f);
      if (!fs.existsSync(p)) continue;
      try {
        return jsonBlockKeys(fs.readFileSync(p, "utf8"), "mcp");
      } catch {}
    }
  }
  return [];
}

async function collectOpenCode(scan, mcpNames) {
  for (const db of opencodeDbs()) {
    await scan.file("opencode", db, async (out) => {
      const rows = await queryAll(db, "SELECT data, time_created FROM part WHERE data LIKE '%\"type\":\"tool\"%'");
      if (!rows) throw new Error("sqlite unavailable");
      for (const r of rows) {
        let d;
        try {
          d = JSON.parse(r.data);
        } catch {
          continue;
        }
        if (!d || d.type !== "tool") continue;
        const name = typeof d.tool === "string" ? d.tool : "";
        if (!name) continue;
        let ts = Number(r.time_created);
        if (!isFinite(ts) || ts <= 0) ts = 0;
        const lower = name.toLowerCase();
        const server = mcpNames.find((n) => lower === n.toLowerCase() || lower.startsWith(n.toLowerCase() + "_"));
        if (server) out.add({ i: d.callID != null ? String(d.callID) : null, t: ts, k: "mcp", s: server, n: name.slice(server.length + 1) || name });
        else out.add({ i: d.callID != null ? String(d.callID) : null, t: ts, k: "tool", n: name });
      }
    });
  }
}

function installedInfo() {
  const skills = [];
  const seen = new Set();
  for (const root of claudeConfigRoots()) {
    const dir = path.join(root, "skills");
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (!fs.existsSync(path.join(dir, e.name, "SKILL.md"))) continue;
      if (!seen.has(e.name)) {
        seen.add(e.name);
        skills.push(e.name);
      }
    }
  }
  skills.sort();

  const claudeMcp = new Set();
  for (const root of claudeConfigRoots()) {
    const p = path.join(root, ".claude.json");
    if (!fs.existsSync(p)) continue;
    try {
      const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const k of Object.keys(cfg.mcpServers || {})) claudeMcp.add(k);
    } catch {}
  }

  const codexMcp = new Set();
  for (const h of [...new Set(envDirs("CODEX_HOME").length ? envDirs("CODEX_HOME") : [path.join(HOME, ".codex")])]) {
    const p = path.join(h, "config.toml");
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, "utf8");
      const re = /^\s*\[mcp_servers\.([^"\].\]]+)\]/gm;
      let m;
      while ((m = re.exec(raw))) codexMcp.add(m[1]);
    } catch {}
  }

  return {
    skills,
    mcp: {
      claude: [...claudeMcp].sort(),
      codex: [...codexMcp].sort(),
      opencode: opencodeMcpNames().sort(),
      cursor: cursorMcpNames()
    }
  };
}

async function collectCalls(cacheDir) {
  const scan = new CallScan();
  scan.loadCache(cacheDir);
  const mcpNames = opencodeMcpNames();
  await Promise.all([collectClaude(scan), collectCodex(scan), collectOpenCode(scan, mcpNames), collectCursor(scan)]);
  scan.saveCache();
  return { sources: scan.result(), installed: installedInfo(), scannedAt: new Date().toISOString() };
}

module.exports = { collectCalls };
