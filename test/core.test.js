const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { envDirs, compactEntries, num } = require("../main/normalize");
const { writeJsonFile } = require("../main/jsonfile");
const { costParts } = require("../main/pricing");

describe("envDirs", () => {
  it("splits on comma and semicolon", () => {
    process.env.CINDER_TEST_DIRS = process.platform === "win32" ? "C:\\Users\\me\\.claude;D:\\logs" : "/home/a/.claude,/home/b/.codex";
    const dirs = envDirs("CINDER_TEST_DIRS");
    delete process.env.CINDER_TEST_DIRS;
    if (process.platform === "win32") {
      assert.deepEqual(dirs, ["C:\\Users\\me\\.claude", "D:\\logs"]);
    } else {
      assert.deepEqual(dirs, ["/home/a/.claude", "/home/b/.codex"]);
    }
  });

  it("does not split windows drive letters", () => {
    if (process.platform !== "win32") return;
    process.env.CINDER_TEST_DIRS = "C:\\Users\\me\\.claude";
    const dirs = envDirs("CINDER_TEST_DIRS");
    delete process.env.CINDER_TEST_DIRS;
    assert.deepEqual(dirs, ["C:\\Users\\me\\.claude"]);
  });
});

describe("num", () => {
  it("coerces finite numbers", () => {
    assert.equal(num("3"), 3);
    assert.equal(num(null), 0);
    assert.equal(num(NaN), 0);
  });
});

describe("compactEntries", () => {
  it("merges the same session/model within a minute", () => {
    const t = Date.parse("2026-01-01T00:00:10Z");
    const base = {
      source: "claude",
      model: "opus",
      provider: "anthropic",
      project: "app",
      session: "s1",
      input: 10,
      output: 2,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 0,
      reasoning: 0,
      cost: 1,
      costInput: 1,
      costOutput: 0,
      costCacheWrite: 0,
      costCacheRead: 0
    };
    const out = compactEntries([
      { ...base, t },
      { ...base, t: t + 1000, input: 5, cost: 0.5, costInput: 0.5 }
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].n, 2);
    assert.equal(out[0].input, 15);
    assert.equal(out[0].cost, 1.5);
  });

  it("keeps separate minutes", () => {
    const t = Date.parse("2026-01-01T00:00:10Z");
    const base = {
      source: "claude",
      model: "opus",
      provider: "anthropic",
      project: "app",
      session: "s1",
      input: 1,
      output: 0,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 0,
      reasoning: 0,
      cost: 0,
      costInput: 0,
      costOutput: 0,
      costCacheWrite: 0,
      costCacheRead: 0
    };
    const out = compactEntries([
      { ...base, t },
      { ...base, t: t + 60 * 1000 }
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].n, 1);
  });
});

describe("writeJsonFile", () => {
  it("roundtrips a nested object", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cinder-"));
    const file = path.join(dir, "out.json");
    const value = { v: 2, entries: [{ a: 1 }, { a: 2 }], nested: { ok: true } };
    writeJsonFile(file, value);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), value);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("costParts", () => {
  it("returns zeros for unknown models", () => {
    const c = costParts("definitely-not-a-model", "unknown", {
      input: 1000,
      output: 1000,
      cacheWrite: 0,
      cacheWrite1h: 0,
      cacheRead: 0
    });
    assert.equal(c.input + c.output + c.cacheWrite + c.cacheRead, 0);
  });
});
