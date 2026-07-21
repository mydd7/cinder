import { fmt } from "@/lib/format";
import { colorAt } from "@/lib/palette";
import type { Summary } from "@/lib/types";
import { StatCard, Panel, BarRow } from "@/components/Primitives";

export function Projects({ sum, period }: { sum: Summary; period: number }) {
  const t = sum.totals;
  const periodLabel = period ? `last ${period} days` : "all time";
  const max = sum.projects.length ? sum.projects[0].tokens : 1;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <StatCard icon="projects" label="Projects" value={String(sum.projects.length)} sub="with usage" />
        <StatCard icon="tokens" label="Total tokens" value={fmt.compact(t.tokens)} sub={periodLabel} />
        <StatCard icon="cost" label="Total cost" value={fmt.usd(t.cost)} sub="estimated" />
        <StatCard icon="requests" label="Requests" value={fmt.int(t.requests)} />
      </div>
      <Panel title="Top projects" hint={`by tokens · ${periodLabel}`}>
        {sum.projects.length ? (
          <div className="flex flex-col gap-3.5">
            {sum.projects.slice(0, 16).map((p, i) => (
              <BarRow
                key={p.name}
                name={p.name}
                value={p.tokens}
                max={max}
                color={colorAt(i)}
                amt={
                  <>
                    <b className="font-semibold text-foreground">{fmt.compact(p.tokens)}</b> · {fmt.usd(p.cost)}
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-muted-foreground">No data in this period.</div>
        )}
      </Panel>
    </div>
  );
}
