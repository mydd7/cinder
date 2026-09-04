const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const READER = path.join(__dirname, "sqlite-reader.js");
const UNPACKED = READER.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

function copyLiveDb(dbPath) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cinder-db-"));
  const dest = path.join(dir, "copy.db");
  try {
    fs.copyFileSync(dbPath, dest);
    for (const ext of ["-wal", "-shm"]) {
      const side = dbPath + ext;
      if (fs.existsSync(side)) fs.copyFileSync(side, dest + ext);
    }
    return {
      path: dest,
      cleanup() {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch {}
      }
    };
  } catch {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
    return null;
  }
}

function run(cmd, reader, dbPath, sql, extraEnv) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      [reader, dbPath, sql],
      {
        env: { ...process.env, ...extraEnv },
        maxBuffer: 512 * 1024 * 1024,
        timeout: 10 * 60 * 1000,
        windowsHide: true
      },
      (err, stdout) => {
        if (err) return resolve(null);
        try {
          const arr = JSON.parse(stdout);
          resolve(Array.isArray(arr) ? arr : null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

async function queryAll(dbPath, sql) {
  const viaElectronNode = await run(process.execPath, READER, dbPath, sql, { ELECTRON_RUN_AS_NODE: "1" });
  if (viaElectronNode) return viaElectronNode;
  return run("node", UNPACKED, dbPath, sql, {});
}

async function withLiveDb(dbPath, fn) {
  let direct = true;
  let copy = null;
  const query = async (sql) => {
    if (direct) {
      const rows = await queryAll(dbPath, sql);
      if (rows) return rows;
      direct = false;
    }
    if (!copy) copy = copyLiveDb(dbPath);
    if (!copy) return null;
    return queryAll(copy.path, sql);
  };
  try {
    return await fn(query);
  } finally {
    if (copy) copy.cleanup();
  }
}

function queryLive(dbPath, sql) {
  return withLiveDb(dbPath, (query) => query(sql));
}

module.exports = { queryAll, queryLive, withLiveDb };
