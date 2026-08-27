import { daySeries } from "@/lib/aggregate";
import { fmt } from "@/lib/format";
import { colorAt } from "@/lib/palette";
import type { Summary } from "@/lib/types";
import { StatCard, Panel, BarRow, Legend } from "@/components/Primitives";
import { AreaChart } from "@/components/charts/AreaChart";
import { Donut } from "@/components/charts/Donut";

export function Overview({ sum, period }: { sum: Summary; period: number }) {
  const t = sum.totals;
  const cb = sum.costBy;
  const cacheShare = t.tokens > 0 ? t.cacheRead / t.tokens : 0;
  const avg = t.requests ? t.tokens / t.requests : 0;
  const periodLabel = period ? `last ${period} days` : "all time";
  const models = sum.models.slice(0, 6);
  const maxModel = models.length ? models[0].tokens : 1;
  const series = daySeries(sum.byDay, period);
  const hasCursor = sum.sources.some((s) => s.name === "cursor");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <StatCard icon="tokens" label="Total tokens" value={fmt.compact(t.tokens)} sub={`${fmt.int(t.tokens)} exact`} />
        <StatCard icon="input" label="Input" value={fmt.compact(t.input)} sub="fresh prompt tokens" />
        <StatCard icon="output" label="Output" value={fmt.compact(t.output)} sub="generated tokens" />
        <StatCard icon="requests" label="Requests" value={fmt.int(t.requests)} sub={`${fmt.int(sum.sessions)} sessions`} />
      </div>
      <div className="grid grid-cols-4 gap-3.5">
        <StatCard icon="cost" label="Est. cost" value={fmt.usd(t.cost)} sub={hasCursor ? `${periodLabel} · Cursor has no local tokens` : periodLabel} />
        <StatCard icon="cache" label="Cache reads" value={fmt.compact(t.cacheRead)} sub={<>{fmt.pct(cacheShare)} of all tokens</>} />
        <StatCard icon="avg" label="Avg / request" value={fmt.compact(avg)} sub="tokens per call" />
        <StatCard icon="calendar" label="Active days" value={fmt.int(sum.activeDays)} sub="days with usage" />
      </div>

      <Panel title="Usage over time" hint={`${periodLabel} · total tokens`}>
        <AreaChart series={series} />
      </Panel>

      <div className="grid grid-cols-3 gap-3.5">
        <Panel title="Models" hint="by tokens" className="col-span-2">
          {models.length ? (
            <div className="flex flex-col gap-3.5">
              {models.map((m, i) => (
                <BarRow
                  key={m.name}
                  name={fmt.modelShort(m.name)}
                  value={m.tokens}
                  max={maxModel}
                  color={colorAt(i)}
                  amt={
                    <>
                      <b className="font-semibold text-foreground">{fmt.compact(m.tokens)}</b> · {fmt.pct(m.tokens / (t.tokens || 1))}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-muted-foreground">No data in this period.</div>
          )}
        </Panel>
        <Panel title="Cost breakdown" hint="where spend goes">
          <div className="flex justify-center py-1.5">
            <Donut
              parts={[
                { label: "Cache read", value: cb.cacheRead, color: "var(--data-1)" },
                { label: "Cache write", value: cb.cacheWrite, color: "var(--data-3)" },
                { label: "Output", value: cb.output, color: "var(--data-2)" },
                { label: "Input", value: cb.input, color: "var(--data-4)" }
              ]}
              centerTop={fmt.usd(t.cost)}
              centerBot="est. cost"
              format={fmt.usd}
              valueLabel="Cost"
            />
          </div>
          <Legend
            items={[
              { label: "Cache read", color: "var(--data-1)" },
              { label: "Cache write", color: "var(--data-3)" },
              { label: "Output", color: "var(--data-2)" },
              { label: "Input", color: "var(--data-4)" }
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
