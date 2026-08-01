const fs = require("fs");
const path = require("path");

let DATA = { flat: {}, qualified: {} };
try {
  DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pricing-data.json"), "utf8"));
} catch {
  DATA = { flat: {}, qualified: {} };
}

const FAMILY = [
  { re: /opus/i, in: 5, out: 25, cw: 6.25, cw1h: 10, cr: 0.5 },
  { re: /sonnet/i, in: 3, out: 15, cw: 3.75, cw1h: 6, cr: 0.3 },
  { re: /haiku/i, in: 1, out: 5, cw: 1.25, cw1h: 2, cr: 0.1 },
  { re: /gpt-5.*mini|gpt-4\.1-mini|gpt-4o-mini/i, in: 0.25, out: 2, cw: 0, cr: 0.025 },
  { re: /gpt-5|gpt-4\.1|gpt-4o|codex/i, in: 1.25, out: 10, cw: 0, cr: 0.125 },
  { re: /\bo[134]\b|o1-|o3-|o4-/i, in: 15, out: 60, cw: 0, cr: 7.5 },
  { re: /gemini.*flash|flash/i, in: 0.3, out: 2.5, cw: 0, cr: 0.075 },
  { re: /gemini/i, in: 1.25, out: 10, cw: 0, cr: 0.125 },
  { re: /deepseek/i, in: 0.28, out: 0.42, cw: 0, cr: 0.028 },
  { re: /glm|zhipu/i, in: 0.6, out: 2.2, cw: 0, cr: 0.11 },
  { re: /kimi|moonshot/i, in: 0.6, out: 2.5, cw: 0, cr: 0.15 },
  { re: /qwen/i, in: 0.4, out: 1.2, cw: 0, cr: 0.1 },
  { re: /grok/i, in: 3, out: 15, cw: 0, cr: 0.75 },
  { re: /llama|mistral|mixtral/i, in: 0.5, out: 1.5, cw: 0, cr: 0.1 }
];

const norm = (s) => String(s || "").trim().toLowerCase();

function stripProvider(m) {
  const parts = m.split("/");
  return parts.length > 1 ? parts[parts.length - 1] : m;
}

function candidates(model, provider) {
  const out = [];
  const m = norm(model);
  if (!m) return out;
  const bare = stripProvider(m);
  const push = (v) => v && !out.includes(v) && out.push(v);
  if (provider) {
    push(norm(provider) + "/" + m);
    push(norm(provider) + "/" + bare);
  }
  push(m);
  push(bare);
  const noDate = bare.replace(/[-@](\d{8}|\d{6}|\d{4}-\d{2}-\d{2}|v\d+|latest)$/i, "");
  push(noDate);
  return out;
}

let FLAT_KEYS = null;
function flatKeys() {
  if (!FLAT_KEYS) FLAT_KEYS = Object.keys(DATA.flat);
  return FLAT_KEYS;
}

const BOUNDARY = new Set(["-", ".", "@", ":", "/", "_"]);

function nearest(bare) {
  let best = null;
  for (const k of flatKeys()) {
    if (k === bare) return k;
    const long = k.length > bare.length ? k : bare;
    const short = k.length > bare.length ? bare : k;
    if (!long.startsWith(short) || !BOUNDARY.has(long.charAt(short.length))) continue;
    if (!best || k.length > best.length) best = k;
  }
  return best;
}

function versionScore(rest) {
  const m = rest.match(/^(\d+)(?:[-.](\d+))?/);
  if (!m || m[1].length > 2) return 0;
  const minor = m[2] && m[2].length <= 2 ? Number(m[2]) : 0;
  return Number(m[1]) * 1000 + minor;
}

function sibling(bare) {
  const stem = bare.replace(/[-.]?[\d.]+(?:[-.].*)?$/, "");
  if (stem.length < 4 || stem === bare) return null;
  const prefix = stem + "-";
  let best = null;
  let bestScore = -1;
  for (const k of flatKeys()) {
    if (!k.startsWith(prefix)) continue;
    const score = versionScore(k.slice(prefix.length));
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return bestScore > 0 ? best : null;
}

function lookup(model, provider) {
  for (const c of candidates(model, provider)) {
    if (DATA.qualified[c]) return DATA.qualified[c];
    if (DATA.flat[c]) return DATA.flat[c];
  }
  const bare = stripProvider(norm(model));
  if (bare) {
    const hit = sibling(bare) || nearest(bare);
    if (hit) return DATA.flat[hit];
  }
  for (const f of FAMILY) if (f.re.test(model)) return { in: f.in, out: f.out, cr: f.cr, cw: f.cw, cw1h: f.cw1h };
  return null;
}

const EPOCHS = [];
const seenEpochs = new Set();
function collectEpochs(entries) {
  for (const entry of Object.values(entries)) {
    if (entry && Array.isArray(entry.dated)) {
      for (const d of entry.dated) {
        if (d.until) {
          const ms = new Date(d.until).getTime();
          if (!isNaN(ms) && !seenEpochs.has(ms)) {
            seenEpochs.add(ms);
            EPOCHS.push(ms);
          }
        }
      }
    }
  }
}
if (DATA.flat) collectEpochs(DATA.flat);
if (DATA.qualified) collectEpochs(DATA.qualified);
EPOCHS.sort((a, b) => a - b);

function epochOf(ts) {
  if (!ts) return 0;
  const ms = new Date(ts).getTime();
  if (isNaN(ms)) return 0;
  let epoch = 0;
  for (let i = 0; i < EPOCHS.length; i++) {
    if (ms < EPOCHS[i]) {
      break;
    }
    epoch = i + 1;
  }
  return epoch;
}

function getDatedRate(p, ts) {
  if (!p) return null;
  if (ts && Array.isArray(p.dated)) {
    const ms = new Date(ts).getTime();
    if (!isNaN(ms)) {
      for (const d of p.dated) {
        const untilMs = new Date(d.until).getTime();
        if (!isNaN(untilMs) && ms < untilMs) {
          return d;
        }
      }
    }
  }
  return p;
}

const CACHE = new Map();

function priceFor(model, provider, ts) {
  const epoch = epochOf(ts);
  const key = (model || "") + "|" + (provider || "") + "|" + epoch;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const base = lookup(model, provider);
  const p = getDatedRate(base, ts);
  const write = /opus|sonnet|haiku/i.test(model) || norm(provider) === "anthropic";
  const out = p
    ? {
        in: p.in || 0,
        out: p.out || 0,
        cacheWrite: p.cw !== undefined ? p.cw : write ? (p.in || 0) * 1.25 : 0,
        cacheWrite1h: p.cw1h !== undefined ? p.cw1h : p.cw ? p.cw * 1.6 : write ? (p.in || 0) * 2 : 0,
        cacheRead: p.cr !== undefined ? p.cr : (p.in || 0) * 0.1,
        known: true
      }
    : { in: 0, out: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, known: false };
  CACHE.set(key, out);
  return out;
}

function costParts(model, provider, u, ts) {
  const p = priceFor(model, provider, ts);
  const w1h = Math.min(u.cacheWrite1h || 0, u.cacheWrite);
  const w5m = u.cacheWrite - w1h;
  return {
    input: (u.input / 1e6) * p.in,
    output: (u.output / 1e6) * p.out,
    cacheWrite: (w5m / 1e6) * p.cacheWrite + (w1h / 1e6) * p.cacheWrite1h,
    cacheRead: (u.cacheRead / 1e6) * p.cacheRead
  };
}

function costOf(model, provider, u, ts) {
  const c = costParts(model, provider, u, ts);
  return c.input + c.output + c.cacheWrite + c.cacheRead;
}

function hasRate(model, provider) {
  for (const c of candidates(model, provider)) {
    if (DATA.qualified[c] || DATA.flat[c]) return true;
  }
  return false;
}

module.exports = { priceFor, costOf, costParts, hasRate };
