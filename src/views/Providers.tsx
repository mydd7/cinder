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
      .sort((a, b) => b.sum.totals.tokens - a.sum.totals.tokens || b.sum.totals.requests - a.sum.totals.requests);
  }, [entries]);

  const tokenSources = full.sources.filter((s) => s.tokens > 0);
  const costSources = [...full.sources].filter((s) => s.cost > 0).sort((a, b) => b.cost - a.cost);
  const maxTok = tokenSources.length ? tokenSources[0].tokens : 1;
  const maxCost = Math.max(1, ...costSources.map((s) => s.cost));

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
            {tokenSources.length ? (
              tokenSources.map((s) => (
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
              ))
            ) : (
              <div className="text-[12px] text-muted-foreground">No token counts in local logs.</div>
            )}
          </div>
        </Panel>
        <Panel title="Cost share" hint="by provider">
          <div className="flex flex-col gap-3.5">
            {costSources.length ? (
              costSources.map((s) => (
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
              ))
            ) : (
              <div className="text-[12px] text-muted-foreground">No cost data in local logs.</div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {perProvider.map(({ name, sum }) => {
          const models = sum.models;
          const byReqs = sum.totals.tokens === 0 && sum.totals.requests > 0;
          const maxM = byReqs
            ? Math.max(1, ...models.map((m) => m.requests))
            : models.length
              ? models[0].tokens
              : 1;
          const cursor = name === "cursor";
          return (
            <Panel
              key={name}
              title={provLabel(name)}
              hint={cursor ? "requests only · no local tokens" : `${sum.models.length} models · ${fmt.int(sum.sessions)} sessions`}
            >
              <div className="mb-3.5 grid grid-cols-3 gap-2">
                {[
                  { k: "Tokens", v: cursor ? "—" : fmt.compact(sum.totals.tokens) },
                  { k: "Requests", v: fmt.int(sum.totals.requests) },
                  { k: "Cost", v: cursor ? "—" : fmt.usd(sum.totals.cost) }
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
                    value={byReqs ? m.requests : m.tokens}
                    max={maxM}
                    color={i === 0 ? color(name) : "var(--muted-foreground)"}
                    amt={<b className="font-semibold text-foreground">{byReqs ? fmt.int(m.requests) : fmt.compact(m.tokens)}</b>}
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
