const fs = require("fs");
const path = require("path");
const { envDirs, HOME } = require("../normalize");
const { queryAll } = require("../sqlite");
const { parseMessage } = require("./_message");

function dbs() {
  const env = envDirs("KILO_DATA_DIR");
  const roots = env.length ? env : [path.join(HOME, ".local", "share", "kilo")];
  const out = [];
  for (const dir of [...new Set(roots)]) {
    const p = path.join(dir, "kilo.db");
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

async function collect(cx) {
  for (const db of dbs()) {
    await cx.scanFile("kilo", path.dirname(db), db, async (out) => {
      const rows = await queryAll(db, "SELECT id, session_id, data FROM message");
      if (!rows) throw new Error("sqlite unavailable");
      for (const r of rows) {
        let d;
        try {
          d = JSON.parse(r.data);
        } catch {
          continue;
        }
        const e = parseMessage(d, { source: "kilo", session: r.session_id });
        if (e) out.add(e);
      }
    });
  }
}

module.exports = { id: "kilo", label: "Kilo Code", collect };
