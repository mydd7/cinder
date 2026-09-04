#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const MODELSDEV_URL = "https://models.dev/api.json";
const OUT = path.join(__dirname, "..", "pricing-data.json");

const M = 1e6;

const RANK = [
  [/^(anthropic|openai|gemini|google|vertex_ai|xai|deepseek|moonshot|mistral|cohere|groq)$/, 0],
  [/^(zhipu|z-ai|alibaba|qwen|dashscope|meta|meta-llama|perplexity|ai21|nvidia)$/, 1],
  [/^(bedrock|bedrock_converse|azure|azure_ai|vertex_ai-.*|amazon-bedrock|google-vertex.*)$/, 3],
  [/^(openrouter|together_ai|fireworks_ai|deepinfra|novita|nebius|hyperbolic)$/, 5]
];
const AGGREGATOR_RANK = 7;
const DERIVED_PENALTY = 2;

const OVERRIDES = {
  "claude-sonnet-5": {
    in: 3,
    out: 15,
    cr: 0.3,
    cw: 3.75,
    cw1h: 6,
    dated: [{ until: "2026-09-01T00:00:00Z", in: 2, out: 10, cr: 0.2, cw: 2.5, cw1h: 4 }]
  }
};

const OVERRIDE_ALIASES = (base) => [
  base,
  `anthropic/${base}`,
  `${base}@default`,
  `anthropic.${base}`,
  `us.anthropic.${base}`,
  `global.anthropic.${base}`,
  `au.anthropic.${base}`,
  `jp.anthropic.${base}`
];

const norm = (s) => String(s || "").trim().toLowerCase();

function rankOf(provider) {
  const p = norm(provider);
  for (const [re, r] of RANK) if (re.test(p)) return r;
  return AGGREGATOR_RANK;
}

function bareOf(id) {
  const parts = String(id).split("/");
  return parts.length > 1 ? parts[parts.length - 1] : String(id);
}

function round(n) {
  if (!isFinite(n) || n === 0) return 0;
  return Number(n.toPrecision(10));
}

function expand(id) {
  const out = [id];
  const dotted = id.replace(/-(\d+)-(\d+)\b/g, "-$1.$2");
  if (dotted !== id) out.push(dotted);
  for (const v of [...out]) {
    const undated = v.replace(/[-@](\d{8}|\d{4}-\d{2}-\d{2})$/, "");
    if (undated !== v && undated.length > 3) out.push(undated);
  }
  return out;
}

function anthropicish(id, provider) {
  return /claude|anthropic/i.test(id) || /anthropic/i.test(String(provider || ""));
}

function makeRate(id, provider, { input, output, cacheWrite, cacheRead, cacheWrite1h }) {
  if (typeof input !== "number" || !isFinite(input)) return null;
  const rate = {
    in: round(input),
    out: round(typeof output === "number" && isFinite(output) ? output : 0),
    cr: round(cacheRead || 0),
    cw: round(cacheWrite || 0)
  };
  if (anthropicish(id, provider) && rate.in > 0) {
    if (!rate.cw) rate.cw = round(rate.in * 1.25);
    if (!rate.cr) rate.cr = round(rate.in * 0.1);
    const ratio = cacheWrite1h ? cacheWrite1h / rate.in : 0;
    rate.cw1h = round(ratio >= 1.5 && ratio <= 3 ? cacheWrite1h : rate.in * 2);
  } else if (cacheWrite1h) {
    rate.cw1h = round(cacheWrite1h);
  }
  return rate;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "cinder-pricing-build" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function fromLiteLLM(data) {
  const rows = [];
  for (const [key, m] of Object.entries(data)) {
    if (key === "sample_spec" || !m || typeof m !== "object") continue;
    if (typeof m.input_cost_per_token !== "number") continue;

    const provider = m.litellm_provider || (key.includes("/") ? key.split("/")[0] : "");
    const rate = makeRate(key, provider, {
      input: m.input_cost_per_token * M,
      output: (m.output_cost_per_token || 0) * M,
      cacheWrite: (m.cache_creation_input_token_cost || 0) * M,
      cacheRead: (m.cache_read_input_token_cost || 0) * M,
      cacheWrite1h: (m.cache_creation_input_token_cost_above_1hr || 0) * M
    });
    if (!rate) continue;

    const scoped = key.includes("/");
    const model = scoped ? key.slice(key.indexOf("/") + 1) : key;
    const base = rankOf(provider);
    const derived = scoped ? base + DERIVED_PENALTY : base;

    const aliases = [];
    expand(key).forEach((a, i) => aliases.push({ alias: a, rank: base, exact: i === 0 }));
    expand(model).forEach((a, i) => aliases.push({ alias: a, rank: derived, exact: i === 0 }));
    expand(bareOf(key)).forEach((a, i) =>
      aliases.push({ alias: a, rank: derived, exact: i === 0 })
    );

    rows.push({ key, provider, rate, aliases });
  }
  return rows;
}

function fromModelsDev(data) {
  const rows = [];
  for (const [provider, p] of Object.entries(data)) {
    if (!p || !p.models) continue;
    for (const [id, m] of Object.entries(p.models)) {
      const c = m && m.cost;
      if (!c || typeof c.input !== "number") continue;

      const rate = makeRate(id, provider, {
        input: c.input,
        output: c.output,
        cacheWrite: c.cache_write,
        cacheRead: c.cache_read
      });
      if (!rate) continue;

      const base = rankOf(provider);
      const aliases = [];
      expand(id).forEach((a, i) => aliases.push({ alias: a, rank: base, exact: i === 0 }));
      expand(bareOf(id)).forEach((a, i) =>
        aliases.push({ alias: a, rank: base, exact: i === 0 })
      );

      rows.push({ key: `${provider}/${id}`, provider, rate, aliases });
    }
  }
  return rows;
}

function weightOf(rank) {
  if (rank <= 1) return 4;
  if (rank <= 3) return 2;
  return 1;
}

function sigOf(rate) {
  return rate.in + "|" + rate.out;
}

function pick(proposals) {
  const votes = new Map();
  for (const p of proposals) {
    const sig = sigOf(p.rate);
    votes.set(sig, (votes.get(sig) || 0) + weightOf(p.rank));
  }

  let best = null;
  for (const p of proposals) {
    const score = [
      p.tier,
      -(votes.get(sigOf(p.rate)) || 0),
      p.rank,
      p.exact ? 0 : 1,
      p.key
    ];
    if (!best) {
      best = { p, score };
      continue;
    }
    for (let i = 0; i < score.length; i++) {
      if (score[i] === best.score[i]) continue;
      if (score[i] < best.score[i]) best = { p, score };
      break;
    }
  }
  return best ? best.p.rate : null;
}

function build(litellm, modelsdev) {
  const feeds = [
    { tier: 0, rows: fromLiteLLM(litellm) },
    { tier: 1, rows: fromModelsDev(modelsdev) }
  ];

  const flatProposals = new Map();
  const qualProposals = new Map();

  for (const { tier, rows } of feeds) {
    for (const row of rows) {
      const seen = new Set();
      for (const { alias, rank, exact } of row.aliases) {
        const a = norm(alias);
        if (!a || seen.has(a)) continue;
        seen.add(a);

        const proposal = { tier, rank, exact, key: row.key, rate: row.rate };

        if (!flatProposals.has(a)) flatProposals.set(a, []);
        flatProposals.get(a).push(proposal);

        if (row.provider) {
          const q = norm(row.provider) + "/" + a;
          if (!qualProposals.has(q)) qualProposals.set(q, []);
          qualProposals.get(q).push(proposal);
        }
      }
    }
  }

  const flat = {};
  for (const [alias, proposals] of flatProposals) {
    const rate = pick(proposals);
    if (rate) flat[alias] = rate;
  }

  const qualified = {};
  for (const [q, proposals] of qualProposals) {
    const rate = pick(proposals);
    if (rate) qualified[q] = rate;
  }

  for (const [base, rate] of Object.entries(OVERRIDES)) {
    for (const alias of OVERRIDE_ALIASES(base)) {
      const a = norm(alias);
      flat[a] = rate;
      for (const q of Object.keys(qualified)) {
        if (q.endsWith("/" + a)) qualified[q] = rate;
      }
    }
  }

  return { flat, qualified };
}

const EXPECT = [
  ["claude-sonnet-4-20250514", { in: 3, out: 15, cw: 3.75, cw1h: 6, cr: 0.3 }],
  ["claude-opus-4-20250514", { in: 15, out: 75, cw: 18.75, cw1h: 30, cr: 1.5 }],
  ["claude-3-7-sonnet-20250219", { in: 3, out: 15, cw: 3.75, cw1h: 6, cr: 0.3 }],
  ["claude-3-haiku-20240307", { in: 0.25, out: 1.25, cw: 0.3, cw1h: 0.5, cr: 0.03 }],
  ["claude-3-opus-20240229", { in: 15, out: 75, cw: 18.75, cw1h: 30, cr: 1.5 }],
  ["claude-3-5-haiku-20241022", { in: 0.8, out: 4, cw: 1, cw1h: 1.6, cr: 0.08 }],
  ["claude-3.5-haiku", { in: 0.8, out: 4 }],
  ["claude-sonnet-4-5", { in: 3, out: 15, cw: 3.75, cw1h: 6, cr: 0.3 }],
  ["claude-sonnet-4-5-20250929", { in: 3, out: 15, cw: 3.75, cw1h: 6, cr: 0.3 }],
  ["claude-opus-4-1", { in: 15, out: 75, cw: 18.75, cw1h: 30, cr: 1.5 }],
  ["claude-opus-4-5", { in: 5, out: 25, cw: 6.25, cw1h: 10, cr: 0.5 }],
  ["claude-opus-5", { in: 5, out: 25, cw: 6.25, cw1h: 10, cr: 0.5 }],
  ["claude-haiku-4-5", { in: 1, out: 5, cw: 1.25, cw1h: 2, cr: 0.1 }],
  ["claude-haiku-4.5", { in: 1, out: 5 }],
  ["claude-fable-5", { in: 10, out: 50, cw: 12.5, cw1h: 20, cr: 1 }],
  ["gpt-5", { in: 1.25, out: 10 }],
  ["gpt-5.1-codex", { in: 1.25, out: 10 }],
  ["gemini-2.5-pro", { in: 1.25, out: 10 }]
];

function validate(data) {
  const problems = [];

  for (const [key, want] of EXPECT) {
    const got = data.flat[key];
    if (!got) {
      problems.push(`missing ${key}`);
      continue;
    }
    for (const [field, value] of Object.entries(want)) {
      if (Math.abs((got[field] || 0) - value) > 0.001) {
        problems.push(`${key}.${field} = ${got[field]}, expected ${value}`);
      }
    }
  }

  for (const [key, rate] of Object.entries(data.flat)) {
    if (!/claude/.test(key) || rate.in === 0) continue;
    if (!(rate.cw > 0) || !(rate.cr > 0)) problems.push(`${key} has zero cache pricing`);
    const ratio = rate.cw1h / rate.in;
    if (rate.cw1h && (ratio < 1.5 || ratio > 3)) {
      problems.push(`${key} cw1h ${rate.cw1h} is ${ratio.toFixed(1)}x input`);
    }
  }

  return problems;
}

async function main() {
  process.stdout.write("fetching LiteLLM + models.dev ...\n");
  const [litellm, modelsdev] = await Promise.all([
    fetchJson(LITELLM_URL),
    fetchJson(MODELSDEV_URL)
  ]);

  const data = build(litellm, modelsdev);

  const problems = validate(data);
  if (problems.length) {
    process.stderr.write("refusing to write, validation failed:\n");
    for (const p of problems.slice(0, 30)) process.stderr.write("  " + p + "\n");
    if (problems.length > 30) process.stderr.write(`  ... ${problems.length - 30} more\n`);
    process.exit(1);
  }

  writeOut(data);
}

function stable(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stable(v[k]))
      .join(",") +
    "}"
  );
}

function intern(data) {
  const rates = [];
  const index = new Map();
  const idx = (rate) => {
    const s = stable(rate);
    if (index.has(s)) return index.get(s);
    const i = rates.length;
    index.set(s, i);
    rates.push(rate);
    return i;
  };
  const pack = (src) => {
    const out = {};
    for (const k of Object.keys(src).sort()) out[k] = idx(src[k]);
    return out;
  };
  return { rates, flat: pack(data.flat), qualified: pack(data.qualified) };
}

function inflate(raw) {
  if (!raw || typeof raw !== "object") return { flat: {}, qualified: {} };
  if (!Array.isArray(raw.rates)) {
    return { flat: raw.flat || {}, qualified: raw.qualified || {} };
  }
  const expand = (map) => {
    const out = {};
    for (const [k, i] of Object.entries(map || {})) {
      const r = typeof i === "number" ? raw.rates[i] : i;
      if (r) out[k] = r;
    }
    return out;
  };
  return { flat: expand(raw.flat), qualified: expand(raw.qualified) };
}

function writeOut(data) {
  const packed = intern(data);
  fs.writeFileSync(OUT, JSON.stringify(packed, null, 2) + "\n");
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  process.stdout.write(
    `wrote pricing-data.json — ${Object.keys(data.flat).length} aliases, ` +
      `${Object.keys(data.qualified).length} provider-scoped, ${packed.rates.length} unique rates, ${kb} KB\n`
  );
}

if (process.argv.includes("--repack")) {
  const raw = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const data = inflate(raw);
  const problems = validate(data);
  if (problems.length) {
    process.stderr.write("refusing to write, validation failed:\n");
    for (const p of problems.slice(0, 30)) process.stderr.write("  " + p + "\n");
    process.exit(1);
  }
  writeOut(data);
} else {
  main().catch((err) => {
    process.stderr.write(String((err && err.stack) || err) + "\n");
    process.exit(1);
  });
}
