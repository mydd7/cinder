const fs = require("fs");
const path = require("path");
const os = require("os");
const { costParts } = require("./pricing");
const { writeJsonFile } = require("./jsonfile");

const HOME = os.homedir();

function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function walk(dir, ext, hit) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(full, ext, hit);
    else if (e.isFile() && e.name.endsWith(ext)) hit(full);
  }
}

const NL = 10;
const CR = 13;

function readJsonl(file, onObj, filter) {
  return new Promise((resolve) => {
    let stream;
    try {
      stream = fs.createReadStream(file, { highWaterMark: 1 << 20 });
    } catch {
      return resolve();
    }
    let rest = null;
    const handle = (line) => {
      let end = line.length;
      if (end && line[end - 1] === CR) end--;
      if (!end) return;
      if (end !== line.length) line = line.subarray(0, end);
      if (filter && !filter(line)) return;
      let o;
      try {
        o = JSON.parse(line.toString("utf8"));
      } catch {
        return;
      }
      if (o === undefined) return;
      try {
        onObj(o);
      } catch {}
    };
    stream.on("data", (chunk) => {
      const data = rest ? Buffer.concat([rest, chunk]) : chunk;
      let start = 0;
      let nl;
      while ((nl = data.indexOf(NL, start)) !== -1) {
        handle(data.subarray(start, nl));
        start = nl + 1;
      }
      rest = start < data.length ? Buffer.from(data.subarray(start)) : null;
    });
    stream.on("end", () => {
      if (rest) handle(rest);
      rest = null;
      resolve();
    });
    stream.on("error", () => resolve());
  });
}

async function mapLimit(items, limit, fn) {
  const n = items.length;
  if (n === 0) return;
  let i = 0;
  const workers = new Array(Math.min(limit, n)).fill(0).map(async () => {
    while (i < n) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function toIso(v) {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function envDirs(name) {
  const raw = process.env[name];
  if (!raw) return [];
  const sep = process.platform === "win32" ? /[,;]/ : /[,;:]/;
  return raw.split(sep).map((s) => s.trim()).filter(Boolean);
}

const USAGE_VERSION = 2;
const BUCKET_MS = 60 * 1000;

function compactEntries(entries) {
  const out = [];
  const open = new Map();
  for (const e of entries) {
    const bucket = Math.floor(e.t / BUCKET_MS);
    const key = e.source + "\0" + e.model + "\0" + e.provider + "\0" + e.project + "\0" + e.session;
    const cur = open.get(key);
    if (cur && cur.bucket === bucket) {
      const m = cur.entry;
      m.input += e.input;
      m.output += e.output;
      m.cacheWrite += e.cacheWrite;
      m.cacheWrite1h += e.cacheWrite1h;
      m.cacheRead += e.cacheRead;
      m.reasoning += e.reasoning;
      m.cost += e.cost;
      m.costInput += e.costInput;
      m.costOutput += e.costOutput;
      m.costCacheWrite += e.costCacheWrite;
      m.costCacheRead += e.costCacheRead;
      m.n += e.n || 1;
      continue;
    }
    const m = { ...e, n: e.n || 1 };
    out.push(m);
    open.set(key, { bucket, entry: m });
  }
  return out;
}

class Collector {
  constructor() {
    this.entries = [];
    this.seen = new Map();
    this.sources = new Map();
    this.home = HOME;
    this.cacheIn = {};
    this.cacheOut = {};
    this.cachePath = null;
    this.onFile = null;
  }

  loadCache(dir) {
    if (!dir) return;
    this.cachePath = path.join(dir, "scan-cache.json");
    try {
      const raw = JSON.parse(fs.readFileSync(this.cachePath, "utf8"));
      if (raw && raw.v === 3 && raw.files) this.cacheIn = raw.files;
    } catch {}
  }

  saveCache() {
    if (!this.cachePath) return;
    try {
      writeJsonFile(this.cachePath, { v: 3, files: this.cacheOut });
    } catch {}
  }

  async scanFile(source, dir, key, parseFn) {
    let st;
    try {
      st = fs.statSync(key);
    } catch {
      return;
    }
    let sig = st.mtimeMs + ":" + st.size;
    try {
      const wal = fs.statSync(key + "-wal");
      sig += ":" + wal.mtimeMs + ":" + wal.size;
    } catch {}
    const cached = this.cacheIn[key];
    let raws;
    if (cached && cached.sig === sig) {
      raws = cached.e;
    } else {
      raws = [];
      try {
        await parseFn({ add: (e) => raws.push(e) });
      } catch {
        return;
      }
    }
    this.cacheOut[key] = { sig, e: raws };
    let added = false;
    for (const e of raws) if (this.add(e)) added = true;
    if (added) this.file(source, dir);
    if (this.onFile) this.onFile();
  }

  stat(source) {
    if (!this.sources.has(source)) this.sources.set(source, { source, files: 0, entries: 0, dirs: [] });
    return this.sources.get(source);
  }

  file(source, dir) {
    const s = this.stat(source);
    s.files += 1;
    if (dir && !s.dirs.includes(dir)) s.dirs.push(dir);
  }

  add(e) {
    const ts = toIso(e.ts);
    if (!ts) return false;
    const usage = {
      input: num(e.input),
      output: num(e.output),
      cacheWrite: num(e.cacheWrite),
      cacheWrite1h: num(e.cacheWrite1h),
      cacheRead: num(e.cacheRead)
    };
    const reasoning = num(e.reasoning);
    usage.output += reasoning;
    if (usage.input + usage.output + usage.cacheWrite + usage.cacheRead === 0 && !e.allowEmpty) return false;
    if (e.dedup) {
      const key = e.source + ":" + e.dedup;
      const prev = this.seen.get(key);
      if (prev) {
        let changed = false;
        for (const f of ["input", "output", "cacheWrite", "cacheWrite1h", "cacheRead"]) {
          if (usage[f] > prev[f]) { prev[f] = usage[f]; changed = true; }
        }
        if (reasoning > prev.reasoning) { prev.reasoning = reasoning; changed = true; }
        if (changed) {
          const model = prev.model;
          const provider = prev.provider;
          const u = {
            input: prev.input,
            output: prev.output,
            cacheWrite: prev.cacheWrite,
            cacheWrite1h: prev.cacheWrite1h,
            cacheRead: prev.cacheRead
          };
          const parts = costParts(model, provider, u, prev.ts);
          const computed = parts.input + parts.output + parts.cacheWrite + parts.cacheRead;
          prev.costInput = parts.input;
          prev.costOutput = parts.output;
          prev.costCacheWrite = parts.cacheWrite;
          prev.costCacheRead = parts.cacheRead;
          prev.cost = typeof e.cost === "number" && isFinite(e.cost) ? e.cost : computed;
        }
        return false;
      }
    }
    const model = e.model || "unknown";
    const provider = e.provider || e.source;
    const parts = costParts(model, provider, usage, ts);
    const computed = parts.input + parts.output + parts.cacheWrite + parts.cacheRead;
    const cost = typeof e.cost === "number" && isFinite(e.cost) ? e.cost : computed;
    const entry = {
      ts,
      t: Date.parse(ts),
      source: e.source,
      model,
      provider,
      project: e.project || e.source,
      session: e.session || e.source,
      input: usage.input,
      output: usage.output,
      cacheWrite: usage.cacheWrite,
      cacheWrite1h: usage.cacheWrite1h,
      cacheRead: usage.cacheRead,
      reasoning,
      cost,
      costInput: parts.input,
      costOutput: parts.output,
      costCacheWrite: parts.cacheWrite,
      costCacheRead: parts.cacheRead
    };
    this.entries.push(entry);
    if (e.dedup) this.seen.set(e.source + ":" + e.dedup, entry);
    this.stat(e.source).entries += 1;
    return true;
  }

  result() {
    this.entries.sort((a, b) => a.t - b.t);
    const entries = compactEntries(this.entries);
    this.entries = [];
    this.seen.clear();
    const sources = [...this.sources.values()]
      .filter((s) => s.entries > 0)
      .map((s) => ({ source: s.source, files: s.files, entries: s.entries, dir: s.dirs[0] || "" }));
    return { v: USAGE_VERSION, entries, sources, home: this.home, scannedAt: new Date().toISOString() };
  }
}

module.exports = { num, walk, readJsonl, mapLimit, toIso, envDirs, compactEntries, Collector, HOME, USAGE_VERSION };
