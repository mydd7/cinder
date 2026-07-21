import { streaks } from "@/lib/aggregate";
import { fmt } from "@/lib/format";
import type { Entry, Summary } from "@/lib/types";
import { Panel } from "@/components/Primitives";
import { Heatmap } from "@/components/charts/Heatmap";
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

  return (
    <div className="flex flex-col gap-3.5">
      <Panel title="Activity map" hint={`${heatLabel} · requests per day`}>
        <Heatmap entries={entries} days={heatDays} />
      </Panel>
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
