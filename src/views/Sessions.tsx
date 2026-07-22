import { useMemo, useState, useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/format";
import type { Entry, Summary } from "@/lib/types";
import { Panel, StatCard } from "@/components/Primitives";
import { useMeasure } from "@/hooks/useMeasure";

interface SessionInfo {
  id: string;
  project: string;
  source: string;
  model: string;
  start: Date;
  end: Date;
  cost: number;
  tokens: number;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  requests: number;
  entries: Entry[];
}

function ContextGrowthChart({ session }: { session: SessionInfo }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const gid = useId().replace(/:/g, "");
  const H = 200;
  const PAD = { l: 55, r: 15, t: 15, b: 25 };
  const W = width || 500;

  const pts_data = session.entries.map((e) => e.input + e.cacheWrite + e.cacheRead);
  const max = Math.max(1, ...pts_data);
  const n = pts_data.length;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const x = (i: number) => (n <= 1 ? PAD.l + plotW / 2 : PAD.l + (i * plotW) / (n - 1));
  const y = (v: number) => PAD.t + plotH * (1 - v / max);

  const pts = pts_data.map((v, i) => ({ x: x(i), y: y(v) }));

  let line = "";
  if (pts.length > 0) {
    line = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      line += ` L ${pts[i].x} ${pts[i].y}`;
    }
  }
  const area = line ? `${line} L ${x(n - 1)} ${H - PAD.b} L ${x(0)} ${H - PAD.b} Z` : "";

  function onMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / (rect.width || W)) * W;
    let i = n <= 1 ? 0 : Math.round(((relX - PAD.l) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover({ i, x: e.clientX, y: e.clientY });
  }

  const hd = hover ? session.entries[hover.i] : null;
  const hVal = hd ? hd.input + hd.cacheWrite + hd.cacheRead : 0;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMove} className="overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((g) => {
          const yy = y(max * g);
          return (
            <g key={g}>
              <line x1={PAD.l} y1={yy} x2={W - PAD.r} y2={yy} stroke="var(--border)" strokeDasharray="2 4" strokeOpacity={0.5} />
              <text x={PAD.l - 8} y={yy + 3.5} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
                {fmt.compact(max * g)}
              </text>
            </g>
          );
        })}
        {area && <path d={area} fill={`url(#${gid})`} />}
        {line && <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} />}
        {n > 1 && [0, Math.floor(n / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
            {`Turn ${i + 1}`}
          </text>
        ))}
        {hd && (
          <>
            <line x1={x(hover!.i)} y1={PAD.t} x2={x(hover!.i)} y2={H - PAD.b} stroke="var(--brand)" strokeWidth={1} strokeOpacity={0.4} />
            <circle cx={x(hover!.i)} cy={y(hVal)} r={4} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hd && (
        <div
          className="absolute z-20 rounded-xl border border-border bg-popover p-2.5 shadow-lg text-[11.5px] pointer-events-none"
          style={{
            left: Math.max(10, Math.min(W - 160, x(hover!.i) - 80)),
            top: 20
          }}
        >
          <div className="font-semibold mb-1 text-foreground">Turn {hover!.i + 1}</div>
          <div className="flex flex-col gap-0.5 text-muted-foreground">
            <div>Input: <span className="font-medium text-foreground">{fmt.int(hd.input)}</span></div>
            <div>Cache Read: <span className="font-medium text-foreground">{fmt.int(hd.cacheRead)}</span></div>
            <div>Cache Write: <span className="font-medium text-foreground">{fmt.int(hd.cacheWrite)}</span></div>
            <div className="border-t border-border mt-1 pt-1">Total: <span className="font-semibold text-foreground">{fmt.int(hVal)}</span></div>
            <div>Cost: <span className="font-semibold text-brand">{fmt.usd(hd.cost)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sessions({ entries }: { entries: Entry[] }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = useMemo(() => {
    const map = new Map<string, SessionInfo>();
    for (const e of entries) {
      const s = e.session || "unknown";
      const ts = new Date(e.ts);
      if (!map.has(s)) {
        map.set(s, {
          id: s,
          project: e.project,
          source: e.source,
          model: e.model,
          start: ts,
          end: ts,
          cost: 0,
          tokens: 0,
          input: 0,
          output: 0,
          cacheWrite: 0,
          cacheRead: 0,
          requests: 0,
          entries: []
        });
      }
      const info = map.get(s)!;
      info.cost += e.cost;
      info.tokens += e.input + e.output + e.cacheWrite + e.cacheRead;
      info.input += e.input;
      info.output += e.output;
      info.cacheWrite += e.cacheWrite;
      info.cacheRead += e.cacheRead;
      info.requests += 1;
      info.entries.push(e);
      if (ts < info.start) info.start = ts;
      if (ts > info.end) info.end = ts;
    }
    for (const info of map.values()) {
      info.entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    }
    return [...map.values()].sort((a, b) => b.end.getTime() - a.end.getTime());
  }, [entries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(query) ||
        s.project.toLowerCase().includes(query) ||
        s.model.toLowerCase().includes(query)
    );
  }, [sessions, search]);

  const active = useMemo(() => {
    if (selectedId) {
      const found = sessions.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return filtered.length ? filtered[0] : null;
  }, [sessions, filtered, selectedId]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
      {/* Left panel: list of sessions */}
      <div className="flex flex-col gap-3.5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl bg-card px-3.5 py-2 pl-9 text-[13px] text-foreground placeholder:text-muted-foreground outline-none border border-border focus:border-brand/40"
          />
          <HugeiconsIcon
            icon={ICON.search}
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
        </div>

        <div className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto pr-1">
          {filtered.map((s) => {
            const isSelected = active?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "flex flex-col gap-1 rounded-2xl p-3 text-left transition-all border",
                  isSelected
                    ? "bg-brand/[0.08] border-brand/35 text-foreground"
                    : "bg-card border-foreground/5 hover:bg-accent/40 text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="truncate text-[13.5px] font-semibold text-foreground">
                    {s.project || "untitled"}
                  </span>
                  <span className="text-[12px] font-semibold text-brand">
                    {fmt.usd(s.cost)}
                  </span>
                </div>
                <div className="truncate text-[11px] font-mono opacity-85">
                  {s.id}
                </div>
                <div className="flex items-center justify-between w-full mt-1.5 text-[11.5px] font-medium">
                  <span className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground font-semibold">
                    {s.source}
                  </span>
                  <span>
                    {s.requests} {s.requests === 1 ? "turn" : "turns"} · {fmt.compact(s.tokens)}
                  </span>
                </div>
                <div className="text-[10.5px] text-muted-foreground opacity-80 mt-1">
                  {s.end.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                </div>
              </button>
            );
          })}
          {!filtered.length && (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              No sessions found.
            </div>
          )}
        </div>
      </div>

      {/* Right panel: details of selected session */}
      {active ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-bold text-foreground truncate">{active.project}</h2>
            <div className="text-[11.5px] font-mono text-muted-foreground truncate">{active.id}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon="cost" label="Cost" value={fmt.usd(active.cost)} sub="estimated spend" />
            <StatCard icon="tokens" label="Tokens" value={fmt.compact(active.tokens)} sub="total tokens" />
            <StatCard icon="sessions" label="Turns" value={fmt.int(active.requests)} sub="API requests" />
            <StatCard icon="models" label="Model" value={fmt.modelShort(active.model)} sub="last used" />
          </div>

          <Panel title="Context growth over turns" hint="hover for details">
            <ContextGrowthChart session={active} />
          </Panel>

          <Panel title="Turns breakdown" hint="history of requests">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-medium">
                    <th className="py-2.5 font-semibold">Turn</th>
                    <th className="py-2.5 font-semibold">Time</th>
                    <th className="py-2.5 font-semibold">Model</th>
                    <th className="py-2.5 text-right font-semibold">Input</th>
                    <th className="py-2.5 text-right font-semibold">Output</th>
                    <th className="py-2.5 text-right font-semibold">Cache Cr</th>
                    <th className="py-2.5 text-right font-semibold">Cache Rd</th>
                    <th className="py-2.5 text-right font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {active.entries.map((e, i) => {
                    const ts = new Date(e.ts);
                    return (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="py-2.5 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="py-2.5 text-muted-foreground">
                          {ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="py-2.5 truncate max-w-[120px] font-medium" title={e.model}>
                          {fmt.modelShort(e.model)}
                        </td>
                        <td className="py-2.5 text-right font-mono tnum">{fmt.int(e.input)}</td>
                        <td className="py-2.5 text-right font-mono tnum">{fmt.int(e.output)}</td>
                        <td className="py-2.5 text-right font-mono tnum text-muted-foreground">
                          {e.cacheWrite > 0 ? fmt.int(e.cacheWrite) : "-"}
                        </td>
                        <td className="py-2.5 text-right font-mono tnum text-muted-foreground">
                          {e.cacheRead > 0 ? fmt.int(e.cacheRead) : "-"}
                        </td>
                        <td className="py-2.5 text-right font-mono tnum font-semibold text-brand">
                          {fmt.usd(e.cost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="grid h-[50vh] place-items-center text-center text-muted-foreground">
          Select a session to view detailed context growth and cost breakdown.
        </div>
      )}
    </div>
  );
}
