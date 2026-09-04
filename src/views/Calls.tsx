import { useMemo, useState, type MouseEvent } from "react";
import { fmt } from "@/lib/format";
import { colorAt } from "@/lib/palette";
import { provColor, provLabel } from "@/lib/providers";
import type { CallsResult } from "@/lib/types";
import { Panel, StatCard, BarRow } from "@/components/Primitives";
import { useMeasure } from "@/hooks/useMeasure";
import { ChartTip } from "@/components/charts/ChartTip";

interface Named {
  name: string;
  count: number;
  sources: string[];
}

interface Merged {
  total: number;
  mcpTotal: number;
  skillTotal: number;
  tools: Named[];
  mcpServers: Named[];
  mcpTools: { server: string; name: string; count: number }[];
  skills: Named[];
  byDay: Record<string, number>;
}

function mergeCalls(calls: CallsResult): Merged {
  const tools = new Map<string, Named>();
  const mcpServers = new Map<string, Named>();
  const mcpTools = new Map<string, { server: string; name: string; count: number }>();
  const skills = new Map<string, Named>();
  const byDay = new Map<string, number>();
  let mcpTotal = 0;
  let skillTotal = 0;

  const into = (map: Map<string, Named>, name: string, count: number, src: string) => {
    const cur = map.get(name);
    if (cur) {
      cur.count += count;
      if (!cur.sources.includes(src)) cur.sources.push(src);
    } else {
      map.set(name, { name, count, sources: [src] });
    }
  };

  for (const [src, s] of Object.entries(calls.sources)) {
    mcpTotal += s.mcpServers.reduce((a, b) => a + b.count, 0);
    skillTotal += s.skills.reduce((a, b) => a + b.count, 0);
    for (const t of s.tools) into(tools, t.name, t.count, src);
    for (const m of s.mcpServers) into(mcpServers, m.name, m.count, src);
    for (const t of s.mcpTools) {
      const key = t.server + "/" + t.name;
      const cur = mcpTools.get(key);
      if (cur) cur.count += t.count;
      else mcpTools.set(key, { server: t.server, name: t.name, count: t.count });
    }
    for (const sk of s.skills) into(skills, sk.name, sk.count, src);
    for (const [d, c] of Object.entries(s.byDay)) byDay.set(d, (byDay.get(d) || 0) + c);
  }

  const sortNamed = (m: Map<string, Named>) => [...m.values()].sort((a, b) => b.count - a.count);

  return {
    total: sortNamed(tools).reduce((a, b) => a + b.count, 0) + mcpTotal + skillTotal,
    mcpTotal,
    skillTotal,
    tools: sortNamed(tools),
    mcpServers: sortNamed(mcpServers),
    mcpTools: [...mcpTools.values()].sort((a, b) => b.count - a.count),
    skills: sortNamed(skills),
    byDay: Object.fromEntries([...byDay].sort())
  };
}

const H = 170;
const PAD = { l: 36, r: 12, t: 12, b: 22 };
const DAY_MS = 24 * 3600000;

function DayBars({ byDay }: { byDay: Record<string, number> }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const W = width || 640;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const keys = Object.keys(byDay).sort();
  if (!keys.length) return <div className="py-6 text-center text-[12px] text-muted-foreground">No data.</div>;

  const start = new Date(keys[0] + "T00:00:00");
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const series: { key: string; v: number }[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const k = fmt.dayKey(new Date(t));
    series.push({ key: k, v: byDay[k] || 0 });
  }

  const n = series.length;
  const max = Math.max(1, ...series.map((s) => s.v));
  const bw = plotW / n;

  function onMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / (rect.width || W)) * W;
    let i = Math.round((relX - PAD.l) / bw - 0.5);
    i = Math.max(0, Math.min(n - 1, i));
    setHover({ i, x: e.clientX, y: e.clientY });
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((g) => {
          const yy = PAD.t + plotH * (1 - g);
          return (
            <g key={g}>
              <line x1={PAD.l} y1={yy} x2={W - PAD.r} y2={yy} stroke="var(--border)" strokeDasharray="2 5" />
              <text x={PAD.l - 7} y={yy + 3} textAnchor="end" className="fill-[var(--muted-foreground)]" fontSize={10} opacity={0.7}>
                {fmt.compact(max * g)}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const bh = s.v > 0 ? Math.max(2, (s.v / max) * plotH) : 0;
          return (
            <rect
              key={s.key}
              x={PAD.l + i * bw + 1}
              y={PAD.t + plotH - bh}
              width={Math.max(1, bw - 2)}
              height={bh}
              rx={Math.min(3, bw / 3)}
              fill="var(--brand)"
              fillOpacity={hover?.i === i ? 1 : s.v === 0 ? 0.06 : 0.25 + 0.65 * (s.v / max)}
            />
          );
        })}
        {[0, Math.floor(n / 2), n - 1].map((i) =>
          series[i] ? (
            <text key={i} x={PAD.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-[var(--muted-foreground)]" fontSize={10} opacity={0.7}>
              {fmt.dayLabel(series[i].key)}
            </text>
          ) : null
        )}
      </svg>
      {hover && (
        <ChartTip
          x={hover.x}
          y={hover.y}
          title={fmt.dayLabel(series[hover.i].key)}
          rows={[{ label: "Calls", value: fmt.int(series[hover.i].v) }]}
        />
      )}
    </div>
  );
}

const TOP = 14;

function SourceDot({ sources }: { sources: string[] }) {
  return (
    <span className="flex shrink-0 gap-0.5">
      {sources.slice(0, 3).map((s) => (
        <span key={s} className="h-1.5 w-1.5 rounded-full" style={{ background: provColor(s) }} title={provLabel(s)} />
      ))}
    </span>
  );
}

export function Calls({ calls }: { calls: CallsResult | null }) {
  const merged = useMemo(() => (calls ? mergeCalls(calls) : null), [calls]);

  const zero = useMemo(() => {
    if (!calls?.installed) return [];
    const rows: { source: string; kind: string; items: string[] }[] = [];
    for (const [src, list] of Object.entries(calls.installed.mcp)) {
      const called = new Set((calls.sources[src]?.mcpServers || []).map((m) => m.name.toLowerCase()));
      const unused = list.filter((n) => !called.has(n.toLowerCase()));
      if (unused.length) rows.push({ source: src, kind: "MCP", items: unused });
    }
    const usedSkills = new Set(merged ? merged.skills.map((s) => s.name.toLowerCase()) : []);
    const unusedSkills = calls.installed.skills.filter((n) => !usedSkills.has(n.toLowerCase()));
    if (unusedSkills.length) rows.push({ source: "claude", kind: "Skill", items: unusedSkills });
    return rows;
  }, [calls, merged]);

  if (!merged) {
    return (
      <div className="grid h-[50vh] place-items-center gap-3.5 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-[var(--brand)]" />
        <div>Scanning tool &amp; MCP call logs…</div>
      </div>
    );
  }

  if (!merged.total) {
    return (
      <div className="grid h-[50vh] place-items-center text-center text-muted-foreground">
        No tool calls found in local logs.
      </div>
    );
  }

  const distinctTools = merged.tools.length + merged.mcpTools.length;
  const sourceCount = Object.keys(calls?.sources || {}).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <StatCard icon="bolt" label="Total calls" value={fmt.int(merged.total)} sub={`${sourceCount} tools tracked`} />
        <StatCard icon="providers" label="MCP calls" value={fmt.int(merged.mcpTotal)} sub={`${merged.mcpServers.length} servers · ${merged.mcpTools.length} tools`} />
        <StatCard icon="models" label="Built-in tools" value={String(distinctTools)} sub="distinct" />
        <StatCard icon="b_spark" label="Skill runs" value={fmt.int(merged.skillTotal)} sub={`${merged.skills.length} distinct`} />
      </div>

      <Panel title="Call volume" hint="tool · MCP · skill invocations per day">
        <DayBars byDay={merged.byDay} />
      </Panel>

      <div className="grid grid-cols-3 gap-3.5">
        <Panel title="Top tools" hint="built-in invocations" bodyClass="flex flex-col gap-3.5">
          {merged.tools.slice(0, TOP).map((t) => (
            <BarRow
              key={t.name}
              name={
                <span className="flex items-center gap-1.5">
                  <SourceDot sources={t.sources} />
                  {t.name}
                </span>
              }
              value={t.count}
              max={merged.tools[0].count}
              color={colorAt(4)}
              amt={<b className="font-semibold text-foreground">{fmt.int(t.count)}</b>}
            />
          ))}
        </Panel>

        <Panel title="MCP activity" hint="by server" bodyClass="flex flex-col gap-3.5">
          {merged.mcpServers.length ? (
            <>
              {merged.mcpServers.slice(0, TOP).map((s) => (
                <BarRow
                  key={s.name}
                  name={s.name}
                  value={s.count}
                  max={merged.mcpServers[0].count}
                  color={colorAt(0)}
                  amt={
                    <>
                      <b className="font-semibold text-foreground">{fmt.int(s.count)}</b> · {s.sources.map(provLabel).join(", ")}
                    </>
                  }
                />
              ))}
              {merged.mcpTools.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
                  {merged.mcpTools.slice(0, 6).map((t) => (
                    <div key={t.server + "/" + t.name} className="flex justify-between gap-2">
                      <span className="truncate">{t.server} › {t.name}</span>
                      <b className="shrink-0 font-semibold tnum text-foreground">{fmt.int(t.count)}</b>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-[12px] text-muted-foreground">No MCP calls detected.</div>
          )}
        </Panel>

        <Panel title="Skills" hint="invocations" bodyClass="flex flex-col gap-3.5">
          {merged.skills.length ? (
            merged.skills.slice(0, TOP).map((s) => (
              <BarRow
                key={s.name}
                name={s.name}
                value={s.count}
                max={merged.skills[0].count}
                color={colorAt(1)}
                amt={
                  <>
                    <b className="font-semibold text-foreground">{fmt.int(s.count)}</b> · {s.sources.map(provLabel).join(", ")}
                  </>
                }
              />
            ))
          ) : (
            <div className="text-[12px] text-muted-foreground">No skill invocations found.</div>
          )}
        </Panel>
      </div>

      <Panel title="Zero-call detection" hint="configured but never invoked">
        {zero.length ? (
          <div className="flex flex-col gap-3.5">
            {zero.map((r) => (
              <div key={r.source + r.kind}>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: provColor(r.source) }} />
                  {r.kind} · {provLabel(r.source)}
                  <span className="tnum opacity-70">· {r.items.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {r.items.map((it) => (
                    <span key={it} className="rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-1 text-[12px] text-muted-foreground">
            All configured MCP servers and skills have been called.
          </div>
        )}
      </Panel>
    </div>
  );
}
