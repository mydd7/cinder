const fs = require("fs");
const path = require("path");
const { envDirs, HOME } = require("../normalize");
const { queryAll } = require("../sqlite");
const { hasRate } = require("../pricing");

const ROUTING_SUFFIX = /-(a|b|low|medium|high|default)$/;

const canonCache = new Map();

function canonical(model, provider) {
  const hit = canonCache.get(model);
  if (hit !== undefined) return hit;
  let out = model;
  if (!hasRate(model, provider)) {
    let stripped = model;
    while (ROUTING_SUFFIX.test(stripped)) {
      stripped = stripped.replace(ROUTING_SUFFIX, "");
      if (hasRate(stripped, provider)) {
        out = stripped;
        break;
      }
    }
  }
  canonCache.set(model, out);
  return out;
}

const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

function reader(buf) {
  return { buf, pos: 0 };
}

function varint(r) {
  let value = 0;
  let shift = 1;
  for (let i = 0; i < 10; i++) {
    if (r.pos >= r.buf.length) return null;
    const byte = r.buf[r.pos++];
    value += (byte & 0x7f) * shift;
    if ((byte & 0x80) === 0) return value;
    shift *= 128;
  }
  return null;
}

function nextField(r) {
  if (r.pos >= r.buf.length) return null;
  const tag = varint(r);
  if (tag === null) return null;
  const field = Math.floor(tag / 8);
  const wire = tag & 7;
  if (field === 0) return null;
  if (wire === WIRE_VARINT) {
    const v = varint(r);
    return v === null ? null : { field, wire, value: v };
  }
  if (wire === WIRE_BYTES) {
    const len = varint(r);
    if (len === null || r.pos + len > r.buf.length) return null;
    const bytes = r.buf.subarray(r.pos, r.pos + len);
    r.pos += len;
    return { field, wire, bytes };
  }
  if (wire === WIRE_FIXED64) {
    if (r.pos + 8 > r.buf.length) return null;
    r.pos += 8;
    return { field, wire };
  }
  if (wire === WIRE_FIXED32) {
    if (r.pos + 4 > r.buf.length) return null;
    r.pos += 4;
    return { field, wire };
  }
  return null;
}

function text(bytes) {
  try {
    const v = Buffer.from(bytes).toString("utf8").trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

function timestamp(bytes) {
  const r = reader(bytes);
  let seconds = null;
  let nanos = 0;
  let f;
  while ((f = nextField(r))) {
    if (f.field === 1 && f.wire === WIRE_VARINT) seconds = f.value;
    else if (f.field === 2 && f.wire === WIRE_VARINT) nanos = f.value;
  }
  if (seconds === null || seconds <= 0) return null;
  return seconds * 1000 + Math.floor(nanos / 1e6);
}

function modelUsage(bytes) {
  const u = {
    modelId: 0,
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 0,
    thinking: 0,
    response: 0,
    messageId: null,
    responseId: null,
    providerMessageId: null
  };
  const r = reader(bytes);
  let f;
  while ((f = nextField(r))) {
    if (f.wire === WIRE_VARINT) {
      if (f.field === 1) u.modelId = f.value;
      else if (f.field === 2) u.input = f.value;
      else if (f.field === 3) u.output = f.value;
      else if (f.field === 4) u.cacheWrite = f.value;
      else if (f.field === 5) u.cacheRead = f.value;
      else if (f.field === 9) u.thinking = f.value;
      else if (f.field === 10) u.response = f.value;
    } else if (f.wire === WIRE_BYTES) {
      if (f.field === 7) u.messageId = text(f.bytes);
      else if (f.field === 11) u.responseId = text(f.bytes);
      else if (f.field === 12) u.providerMessageId = text(f.bytes);
    }
  }
  return u;
}

function retryUsage(bytes) {
  const r = reader(bytes);
  let f;
  while ((f = nextField(r))) {
    if (f.field === 2 && f.wire === WIRE_BYTES) return modelUsage(f.bytes);
  }
  return null;
}

function totalOutput(u) {
  return u.output > 0 ? u.output : u.thinking + u.response;
}

function hasTokens(u) {
  return u.input > 0 || u.cacheRead > 0 || u.cacheWrite > 0 || totalOutput(u) > 0;
}

function identity(u) {
  return u.responseId || u.providerMessageId || u.messageId || null;
}

function parseStep(bytes) {
  const step = { ts: null, usages: [] };
  let startedAt = null;
  const r = reader(bytes);
  let f;
  while ((f = nextField(r))) {
    if (f.wire !== WIRE_BYTES) continue;
    if (f.field === 1) step.ts = timestamp(f.bytes);
    else if (f.field === 32) startedAt = timestamp(f.bytes);
    else if (f.field === 9) step.usages.push(modelUsage(f.bytes));
    else if (f.field === 28) {
      const u = retryUsage(f.bytes);
      if (u) step.usages.push(u);
    }
  }
  if (step.ts === null) step.ts = startedAt;
  return step;
}

function chatModelMetadata(bytes) {
  const gen = { model: null, ts: null, usages: [] };
  const r = reader(bytes);
  let f;
  while ((f = nextField(r))) {
    if (f.wire !== WIRE_BYTES) continue;
    if (f.field === 4) gen.usages.push(modelUsage(f.bytes));
    else if (f.field === 17) {
      const u = retryUsage(f.bytes);
      if (u) gen.usages.push(u);
    } else if (f.field === 19) gen.model = text(f.bytes);
    else if (f.field === 9) {
      const inner = reader(f.bytes);
      let g;
      while ((g = nextField(inner))) {
        if (g.field === 4 && g.wire === WIRE_BYTES) gen.ts = timestamp(g.bytes);
      }
    }
  }
  return gen;
}

function parseGeneration(bytes) {
  const found = [];
  const r = reader(bytes);
  let f;
  while ((f = nextField(r))) {
    if (f.wire !== WIRE_BYTES) continue;
    const gen = chatModelMetadata(f.bytes);
    if (gen.model && gen.usages.some((u) => identity(u))) found.push(gen);
  }
  return found;
}

function providerFor(model) {
  const m = String(model || "").toLowerCase();
  if (m.startsWith("gemini") || m.startsWith("gemma")) return "gemini";
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3")) return "openai";
  return "antigravity";
}

function dirs() {
  const env = envDirs("ANTIGRAVITY_DATA_DIR");
  if (env.length) return [...new Set(env)];
  return [
    path.join(HOME, ".gemini", "antigravity-cli"),
    path.join(HOME, ".gemini", "antigravity")
  ].filter((d) => fs.existsSync(path.join(d, "conversations")));
}

function dbFiles(dir) {
  const out = [];
  try {
    for (const name of fs.readdirSync(path.join(dir, "conversations"))) {
      if (name.endsWith(".db")) out.push(path.join(dir, "conversations", name));
    }
  } catch {}
  return out.sort();
}

function fromHex(h) {
  return Buffer.from(String(h), "hex");
}

async function collect(cx) {
  for (const dir of dirs()) {
    for (const db of dbFiles(dir)) {
      const session = path.basename(db, ".db");
      await cx.scanFile("antigravity", dir, db, async (out) => {
        const genRows = await queryAll(
          db,
          "SELECT hex(data) AS d FROM gen_metadata WHERE data IS NOT NULL ORDER BY idx"
        );
        if (!genRows) throw new Error("sqlite unavailable");

        const models = new Map();
        const generations = [];
        for (const row of genRows) {
          for (const gen of parseGeneration(fromHex(row.d))) {
            generations.push(gen);
            for (const u of gen.usages) {
              const id = identity(u);
              if (id) models.set(id, gen.model);
            }
          }
        }

        const stepRows = await queryAll(
          db,
          "SELECT hex(metadata) AS m FROM steps WHERE metadata IS NOT NULL ORDER BY idx"
        );

        const records = [];
        for (const row of stepRows || []) {
          const step = parseStep(fromHex(row.m));
          for (const u of step.usages) records.push({ ts: step.ts, u });
        }
        for (const gen of generations) {
          for (const u of gen.usages) records.push({ ts: gen.ts, u });
        }

        for (const { ts, u } of records) {
          if (!hasTokens(u)) continue;
          const id = identity(u);
          const raw = (id && models.get(id)) || `antigravity-model-${u.modelId}`;
          const provider = providerFor(raw);
          const model = canonical(raw, provider);
          out.add({
            source: "antigravity",
            ts: ts || null,
            model,
            provider,
            project: "antigravity",
            session,
            dedup: id || undefined,
            input: u.input,
            output: totalOutput(u),
            cacheWrite: u.cacheWrite,
            cacheRead: u.cacheRead,
            reasoning: 0
          });
        }
      });
    }
  }
}

module.exports = { id: "antigravity", label: "Antigravity", collect };
