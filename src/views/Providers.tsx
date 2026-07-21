import { useMemo } from "react";
import { fmt } from "@/lib/format";
import { summarize } from "@/lib/aggregate";
import { provColor, provLabel } from "@/lib/providers";
import type { Entry, Summary } from "@/lib/types";
import { StatCard, Panel, BarRow } from "@/components/Primitives";

const color = provColor;

export function Providers({ full, entries }: { full: Summary; entries: Entry[] }) {
  const t = full.totals;
  const perProvider = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!map.has(e.source)) map.set(e.source, []);
      map.get(e.source)!.push(e);
    }
    return [...map.entries()]
      .map(([name, es]) => ({ name, sum: summarize(es) }))
      .sort((a, b) => b.sum.totals.tokens - a.sum.totals.tokens);
  }, [entries]);

  const maxTok = full.sources.length ? full.sources[0].tokens : 1;
  const maxCost = Math.max(1, ...full.sources.map((s) => s.cost));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <StatCard icon="providers" label="Providers" value={String(full.sources.length)} sub="all time" />
        <StatCard icon="tokens" label="Total tokens" value={fmt.compact(t.tokens)} sub="all time" />
        <StatCard icon="cost" label="Total cost" value={fmt.usd(t.cost)} sub="estimated" />
        <StatCard icon="requests" label="Requests" value={fmt.int(t.requests)} />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <Panel title="Token share" hint="by provider">
          <div className="flex flex-col gap-3.5">
            {full.sources.map((s) => (
              <BarRow
                key={s.name}
                name={provLabel(s.name)}
                value={s.tokens}
                max={maxTok}
                color={color(s.name)}
                amt={
                  <>
                    <b className="font-semibold text-foreground">{fmt.compact(s.tokens)}</b> · {fmt.pct(s.tokens / (t.tokens || 1))}
                  </>
                }
              />
            ))}
          </div>
        </Panel>
        <Panel title="Cost share" hint="by provider">
          <div className="flex flex-col gap-3.5">
            {[...full.sources].sort((a, b) => b.cost - a.cost).map((s) => (
              <BarRow
                key={s.name}
                name={provLabel(s.name)}
                value={s.cost}
                max={maxCost}
                color={color(s.name)}
                amt={
                  <>
                    <b className="font-semibold text-foreground">{fmt.usd(s.cost)}</b> · {fmt.pct(s.cost / (t.cost || 1))}
                  </>
                }
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {perProvider.map(({ name, sum }) => {
          const models = sum.models;
          const maxM = models.length ? models[0].tokens : 1;
          return (
            <Panel key={name} title={provLabel(name)} hint={`${sum.models.length} models · ${fmt.int(sum.sessions)} sessions`}>
              <div className="mb-3.5 grid grid-cols-3 gap-2">
                {[
                  { k: "Tokens", v: fmt.compact(sum.totals.tokens) },
                  { k: "Requests", v: fmt.int(sum.totals.requests) },
                  { k: "Cost", v: fmt.usd(sum.totals.cost) }
                ].map((x) => (
                  <div key={x.k} className="rounded-xl bg-muted/60 px-3 py-2">
                    <div className="text-[10.5px] text-muted-foreground">{x.k}</div>
                    <div className="text-[15px] font-semibold tnum">{x.v}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                {models.map((m, i) => (
                  <BarRow
                    key={m.name}
                    name={fmt.modelShort(m.name)}
                    value={m.tokens}
                    max={maxM}
                    color={i === 0 ? color(name) : "var(--muted-foreground)"}
                    amt={<b className="font-semibold text-foreground">{fmt.compact(m.tokens)}</b>}
                  />
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
