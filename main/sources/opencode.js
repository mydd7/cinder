const fs = require("fs");
const path = require("path");
const { walk, envDirs, HOME } = require("../normalize");
const { queryAll } = require("../sqlite");
const { parseMessage } = require("./_message");

function dirs() {
  const env = envDirs("OPENCODE_DATA_DIR");
  if (env.length) return [...new Set(env)];
  const dataHome = process.env.XDG_DATA_HOME || path.join(HOME, ".local", "share");
  const appData = process.env.APPDATA || path.join(HOME, "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");
  return [
    ...new Set([
      path.join(dataHome, "opencode"),
      path.join(HOME, ".local", "share", "opencode"),
      path.join(appData, "opencode"),
      path.join(localAppData, "opencode"),
      path.join(HOME, "Library", "Application Support", "opencode"),
      path.join(HOME, ".opencode")
    ])
  ].filter((d) => fs.existsSync(d));
}

function dbFiles(dir) {
  const out = [];
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
  return out;
}

function projectsFromDb(db) {
  const map = new Map();
  const rows = queryAll(db, "SELECT id, directory FROM session");
  if (rows) for (const s of rows) if (s.directory) map.set(s.id, path.basename(String(s.directory)));
  return map;
}

function collect(cx) {
  for (const dir of dirs()) {
    let hits = 0;
    for (const db of dbFiles(dir)) {
      const projects = projectsFromDb(db);
      const rows = queryAll(db, "SELECT id, session_id, data FROM message");
      if (!rows) continue;
      for (const r of rows) {
        let d;
        try {
          d = JSON.parse(r.data);
        } catch {
          continue;
        }
        const e = parseMessage(d, { source: "opencode", session: r.session_id, project: projects.get(r.session_id) });
        if (e && cx.add(e)) hits++;
      }
    }
    const msgDir = path.join(dir, "storage", "message");
    const files = [];
    walk(msgDir, ".json", (f) => files.push(f));
    for (const file of files) {
      let d;
      try {
        d = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue;
      }
      const session = path.basename(path.dirname(file));
      const e = parseMessage(d, { source: "opencode", session });
      if (e && cx.add(e)) hits++;
    }
    if (hits > 0) cx.file("opencode", dir);
  }
}

module.exports = { id: "opencode", label: "OpenCode", collect };
