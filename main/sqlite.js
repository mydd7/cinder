const { execFileSync } = require("child_process");
const path = require("path");

const READER = path.join(__dirname, "sqlite-reader.js");

function run(cmd, dbPath, sql, extraEnv) {
  try {
    const raw = execFileSync(cmd, [READER, dbPath, sql], {
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
  const viaElectronNode = run(process.execPath, dbPath, sql, { ELECTRON_RUN_AS_NODE: "1" });
  if (viaElectronNode) return viaElectronNode;
  return run("node", dbPath, sql, {});
}

module.exports = { queryAll, available: () => true };
