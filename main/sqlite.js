const { execFile } = require("child_process");
const path = require("path");

const READER = path.join(__dirname, "sqlite-reader.js");
const UNPACKED = READER.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);

function run(cmd, reader, dbPath, sql, extraEnv) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      [reader, dbPath, sql],
      {
        env: { ...process.env, ...extraEnv },
        maxBuffer: 512 * 1024 * 1024,
        timeout: 30000,
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

module.exports = { queryAll, available: () => true };
