import { useMemo } from "react";
import { requestsOf, streaks } from "@/lib/aggregate";
import { fmt } from "@/lib/format";
import { provColor, provLabel } from "@/lib/providers";
import type { Entry, Summary } from "@/lib/types";
import { Panel } from "@/components/Primitives";
import { Heatmap, HeatLegend } from "@/components/charts/Heatmap";
import { HourlyBars } from "@/components/charts/HourlyBars";

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-[7px] text-[12px] last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <b className="font-semibold tnum">{v}</b>
    </div>
  );
}

export function Activity({ sum, full, entries, period }: { sum: Summary; full: Summary; entries: Entry[]; period: number }) {
  const st = streaks(full.byDay);
  let peak = 0;
  let peakH = 0;
  sum.byHour.forEach((h, i) => {
    if (h.tokens > peak) {
      peak = h.tokens;
      peakH = i;
    }
  });
  const periodLabel = period ? `last ${period} days` : "all time";
  const heatDays = period ? Math.max(period, 1) : 371;
  const heatLabel = period ? `last ${period} days` : "last 12 months";

  const bySource = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      let arr = map.get(e.source);
      if (!arr) map.set(e.source, (arr = []));
      arr.push(e);
    }
    return [...map.entries()].sort((a, b) => requestsOf(b[1]) - requestsOf(a[1]));
  }, [entries]);

  return (
    <div className="flex flex-col gap-3.5">
      <Panel title="Activity map" hint={`${heatLabel} · requests per day`}>
        <Heatmap entries={entries} days={heatDays} />
      </Panel>
      {bySource.length > 1 && (
        <Panel title="By provider" hint={`${heatLabel} · requests per day`}>
          <div className="flex flex-col gap-4">
            {bySource.map(([src, es]) => (
              <div key={src} className="flex items-center gap-3.5">
                <div className="flex w-[110px] shrink-0 items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: provColor(src) }} />
                  <span className="truncate">{provLabel(src)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Heatmap entries={es} days={heatDays} maxCell={14} showLegend={false} />
                </div>
                <span className="w-[52px] shrink-0 text-right text-[11.5px] text-muted-foreground tnum">
                  {fmt.compact(requestsOf(es))}
                </span>
              </div>
            ))}
          </div>
          <HeatLegend />
        </Panel>
      )}
      <div className="grid grid-cols-3 gap-3.5">
        <Panel title="Hourly rhythm" hint={periodLabel} className="col-span-2">
          <HourlyBars byHour={sum.byHour} />
        </Panel>
        <Panel title="Streaks">
          <KV k="Current streak" v={`${st.current} days`} />
          <KV k="Longest streak" v={`${st.longest} days`} />
          <KV k="Active days" v={`${full.activeDays} total`} />
          <KV k="Peak hour" v={`${String(peakH).padStart(2, "0")}:00`} />
          <KV k="Busiest by tokens" v={fmt.compact(peak)} />
        </Panel>
      </div>
    </div>
  );
}
