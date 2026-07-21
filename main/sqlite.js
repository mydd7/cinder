const { execFileSync } = require("child_process");
const path = require("path");

const READER = path.join(__dirname, "sqlite-reader.js");
const UNPACKED = READER.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

function run(cmd, reader, dbPath, sql, extraEnv) {
  try {
    const raw = execFileSync(cmd, [reader, dbPath, sql], {
      env: { ...process.env, ...extraEnv },
      maxBuffer: 512 * 1024 * 1024,
      timeout: 120000,
      stdio: ["ignore", "pipe", "ignore"]
    }).toString();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function queryAll(dbPath, sql) {
  const viaElectronNode = run(process.execPath, READER, dbPath, sql, { ELECTRON_RUN_AS_NODE: "1" });
  if (viaElectronNode) return viaElectronNode;
  return run("node", UNPACKED, dbPath, sql, {});
}

module.exports = { queryAll, available: () => true };
