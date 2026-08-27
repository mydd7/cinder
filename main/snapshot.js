const fs = require("fs");
const path = require("path");

const FILE = "scan-snapshot.json";

function snapshotPath(dir) {
  return path.join(dir, FILE);
}

let cached;

function readSnapshot(dir) {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    const raw = JSON.parse(fs.readFileSync(snapshotPath(dir), "utf8"));
    if (raw && typeof raw === "object") cached = raw;
  } catch {}
  return cached;
}

function snapshotInfo(dir) {
  const snap = readSnapshot(dir);
  if (!snap || !snap.usage) return null;
  const usage = snap.usage;
  return {
    savedAt: snap.savedAt || usage.scannedAt || "",
    entries: Array.isArray(usage.entries) ? usage.entries.length : 0,
    sources: Array.isArray(usage.sources) ? usage.sources.length : 0,
    hasCalls: Boolean(snap.calls)
  };
}

function writeSnapshot(dir, patch) {
  const next = { ...(readSnapshot(dir) || {}), ...patch, savedAt: new Date().toISOString() };
  cached = next;
  try {
    const file = snapshotPath(dir);
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(next));
    fs.renameSync(tmp, file);
  } catch {}
}

function clearSnapshot(dir) {
  cached = null;
  try {
    fs.rmSync(snapshotPath(dir), { force: true });
  } catch {}
}

module.exports = { readSnapshot, snapshotInfo, writeSnapshot, clearSnapshot };
