const fs = require("fs");
const path = require("path");

let DATA = { flat: {}, qualified: {} };
try {
  DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "pricing-data.json"), "utf8"));
} catch {
  DATA = { flat: {}, qualified: {} };
}

const FAMILY = [
  { re: /opus/i, in: 15, out: 75, cw: 18.75, cr: 1.5 },
  { re: /sonnet/i, in: 3, out: 15, cw: 3.75, cr: 0.3 },
  { re: /haiku/i, in: 0.8, out: 4, cw: 1, cr: 0.08 },
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

function lookup(model, provider) {
  const flatKeys = Object.keys(DATA.flat);
  for (const c of candidates(model, provider)) {
    if (DATA.qualified[c]) return DATA.qualified[c];
    if (DATA.flat[c]) return DATA.flat[c];
  }
  const bare = stripProvider(norm(model));
  if (bare) {
    const hit = flatKeys.find((k) => k === bare || k.startsWith(bare) || bare.startsWith(k));
    if (hit) return DATA.flat[hit];
  }
  for (const f of FAMILY) if (f.re.test(model)) return { in: f.in, out: f.out, cr: f.cr, cw: f.cw };
  return null;
}

function priceFor(model, provider) {
  const p = lookup(model, provider);
  if (p) return { in: p.in || 0, out: p.out || 0, cacheWrite: p.cw || 0, cacheRead: p.cr || 0, known: true };
  return { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, known: false };
}

function costParts(model, provider, u) {
  const p = priceFor(model, provider);
  return {
    input: (u.input / 1e6) * p.in,
    output: (u.output / 1e6) * p.out,
    cacheWrite: (u.cacheWrite / 1e6) * p.cacheWrite,
    cacheRead: (u.cacheRead / 1e6) * p.cacheRead
  };
}

function costOf(model, provider, u) {
  const c = costParts(model, provider, u);
  return c.input + c.output + c.cacheWrite + c.cacheRead;
}

module.exports = { priceFor, costOf, costParts };
