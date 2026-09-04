const fs = require("fs");
const path = require("path");
const { writeJsonFile } = require("./jsonfile");
const { compactEntries, USAGE_VERSION } = require("./normalize");

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
  const usage = cached && cached.usage;
  if (usage && usage.v !== USAGE_VERSION && Array.isArray(usage.entries)) {
    usage.entries.sort((a, b) => a.t - b.t);
    usage.entries = compactEntries(usage.entries);
    usage.v = USAGE_VERSION;
  }
  return cached;
}

function snapshotInfo(dir) {
  const snap = readSnapshot(dir);
  if (!snap || !snap.usage) return null;
  const usage = snap.usage;
  return {
    savedAt: snap.savedAt || usage.scannedAt || "",
    entries: Array.isArray(usage.entries) ? usage.entries.reduce((sum, e) => sum + (e.n || 1), 0) : 0,
    sources: Array.isArray(usage.sources) ? usage.sources.length : 0,
    hasCalls: Boolean(snap.calls)
  };
}

function writeSnapshot(dir, patch) {
  const next = { ...(readSnapshot(dir) || {}), ...patch, savedAt: new Date().toISOString() };
  try {
    writeJsonFile(snapshotPath(dir), next);
    cached = next;
  } catch {}
}

function clearSnapshot(dir) {
  cached = null;
  try {
    fs.rmSync(snapshotPath(dir), { force: true });
  } catch {}
}

module.exports = { readSnapshot, snapshotInfo, writeSnapshot, clearSnapshot };
