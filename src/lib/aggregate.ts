import { fmt } from "./format";
import type { Bucket, CostBy, DayPoint, Entry, Summary, Totals } from "./types";

const HOUR = 3600000;

export function blank(): Totals {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, tokens: 0, requests: 0, cost: 0 };
}

function add(t: Totals, e: Entry) {
  t.input += e.input;
  t.output += e.output;
  t.cacheWrite += e.cacheWrite;
  t.cacheRead += e.cacheRead;
  t.tokens += e.input + e.output + e.cacheWrite + e.cacheRead;
  t.requests += 1;
  t.cost += e.cost;
}

export function filterPeriod(entries: Entry[], days: number): Entry[] {
  if (!days) return entries;
  const cut = Date.now() - days * 24 * HOUR;
  return entries.filter((e) => e.t >= cut);
}

export function summarize(entries: Entry[]): Summary {
  const totals = blank();
  const costBy: CostBy = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const byDay = new Map<string, Totals>();
  const byModel = new Map<string, Totals>();
  const modelSource = new Map<string, Map<string, number>>();
  const byProject = new Map<string, Totals>();
  const bySource = new Map<string, Totals>();
  const byHour = Array.from({ length: 24 }, () => ({ tokens: 0, requests: 0 }));
  const sessions = new Set<string>();
  let first: number | null = null;
  let last: number | null = null;

  for (const e of entries) {
    add(totals, e);
    costBy.input += e.costInput;
    costBy.output += e.costOutput;
    costBy.cacheWrite += e.costCacheWrite;
    costBy.cacheRead += e.costCacheRead;
    const t = e.t;
    const d = new Date(t);
    if (first === null || t < first) first = t;
    if (last === null || t > last) last = t;

    const dk = fmt.dayKey(d);
    if (!byDay.has(dk)) byDay.set(dk, blank());
    add(byDay.get(dk)!, e);

    if (!byModel.has(e.model)) byModel.set(e.model, blank());
    add(byModel.get(e.model)!, e);
    if (!modelSource.has(e.model)) modelSource.set(e.model, new Map());
    const ms = modelSource.get(e.model)!;
    ms.set(e.source, (ms.get(e.source) || 0) + e.input + e.output + e.cacheWrite + e.cacheRead);

    if (!byProject.has(e.project)) byProject.set(e.project, blank());
    add(byProject.get(e.project)!, e);

    if (!bySource.has(e.source)) bySource.set(e.source, blank());
    add(bySource.get(e.source)!, e);

    const h = byHour[d.getHours()];
    h.tokens += e.input + e.output + e.cacheWrite + e.cacheRead;
    h.requests += 1;

    sessions.add(e.session);
  }

  const toBuckets = (m: Map<string, Totals>): Bucket[] =>
    [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.tokens - a.tokens || b.requests - a.requests);

  const dominantSource = (model: string): string | undefined => {
    const ms = modelSource.get(model);
    if (!ms) return undefined;
    let best = "";
    let max = -1;
    for (const [s, t] of ms) if (t > max) ((max = t), (best = s));
    return best || undefined;
  };
  const models = [...byModel.entries()].map(([name, v]) => ({ name, source: dominantSource(name), ...v })).sort((a, b) => b.tokens - a.tokens || b.requests - a.requests);

  return {
    totals,
    costBy,
    byDay,
    byHour,
    models,
    projects: toBuckets(byProject),
    sources: toBuckets(bySource),
    sessions: sessions.size,
    activeDays: byDay.size,
    first,
    last,
    count: entries.length
  };
}

export function daySeries(byDay: Map<string, Totals>, days: number): DayPoint[] {
  const out: DayPoint[] = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  let start: Date;
  if (days) {
    start = new Date(end.getTime() - (days - 1) * 24 * HOUR);
  } else {
    const keys = [...byDay.keys()].sort();
    start = keys.length ? new Date(keys[0] + "T00:00:00") : new Date(end);
  }
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * HOUR) {
    const key = fmt.dayKey(new Date(t));
    const v = byDay.get(key) || blank();
    out.push({ key, ...v });
  }
  return out;
}

export interface HeatCell {
  key: string;
  date: Date;
  count: number;
  future: boolean;
}

export function heatmap(entries: Entry[], days = 371): { cells: HeatCell[]; max: number } {
  const counts = new Map<string, number>();
  const cut = Date.now() - days * 24 * HOUR;
  for (const e of entries) {
    const t = e.t;
    if (t < cut) continue;
    const k = fmt.dayKey(new Date(t));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const startDow = new Date(end.getTime() - (days - 1) * 24 * HOUR);
  startDow.setDate(startDow.getDate() - startDow.getDay());
  const cells: HeatCell[] = [];
  let max = 0;
  for (let t = startDow.getTime(); t <= end.getTime(); t += 24 * HOUR) {
    const d = new Date(t);
    const k = fmt.dayKey(d);
    const c = counts.get(k) || 0;
    if (c > max) max = c;
    cells.push({ key: k, date: d, count: c, future: t > end.getTime() });
  }
  return { cells, max };
}

export function streaks(byDay: Map<string, Totals>): { current: number; longest: number } {
  const keys = [...byDay.keys()].sort();
  if (!keys.length) return { current: 0, longest: 0 };
  const set = new Set(keys);
  let longest = 0;
  for (const k of keys) {
    const prev = fmt.dayKey(new Date(new Date(k + "T00:00:00").getTime() - 24 * HOUR));
    if (!set.has(prev)) {
      let len = 0;
      let cur = k;
      while (set.has(cur)) {
        len++;
        cur = fmt.dayKey(new Date(new Date(cur + "T00:00:00").getTime() + 24 * HOUR));
      }
      if (len > longest) longest = len;
    }
  }
  let current = 0;
  let cur = fmt.dayKey(new Date());
  if (!set.has(cur)) cur = fmt.dayKey(new Date(Date.now() - 24 * HOUR));
  while (set.has(cur)) {
    current++;
    cur = fmt.dayKey(new Date(new Date(cur + "T00:00:00").getTime() - 24 * HOUR));
  }
  return { current, longest };
}
