import { fmt } from "@/lib/format";
import { colorAt } from "@/lib/palette";
import { provColor, provLabel } from "@/lib/providers";
import type { Summary } from "@/lib/types";
import { StatCard, Panel } from "@/components/Primitives";

export function Models({ sum, period }: { sum: Summary; period: number }) {
  const t = sum.totals;
  const periodLabel = period ? `last ${period} days` : "all time";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <StatCard icon="models" label="Models used" value={String(sum.models.length)} sub="distinct" />
        <StatCard icon="tokens" label="Total tokens" value={fmt.compact(t.tokens)} sub={periodLabel} />
        <StatCard icon="cost" label="Total cost" value={fmt.usd(t.cost)} sub="estimated" />
        <StatCard icon="requests" label="Requests" value={fmt.int(t.requests)} />
      </div>
      <Panel title="Model breakdown" hint={periodLabel} bodyClass="overflow-x-auto">
        {sum.models.length ? (
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="border-b border-border px-3 py-2.5 text-left font-medium">Model</th>
                <th className="border-b border-border px-3 py-2.5 text-left font-medium">Provider</th>
                {["Input", "Output", "Cache", "Total", "Reqs", "Cost", "Share"].map((h) => (
                  <th key={h} className="border-b border-border px-3 py-2.5 text-right font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sum.models.map((m, i) => (
                <tr key={m.name} className="transition-colors hover:bg-foreground/[0.03]">
                  <td className="border-b border-border px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-[3px]" style={{ background: colorAt(i) }} />
                      {fmt.modelShort(m.name)}
                    </span>
                  </td>
                  <td className="border-b border-border px-3 py-2.5">
                    {m.source ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: provColor(m.source) }} />
                        {provLabel(m.source)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.compact(m.input)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.compact(m.output)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.compact(m.cacheWrite + m.cacheRead)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.compact(m.tokens)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.int(m.requests)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.usd(m.cost)}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right tnum">{fmt.pct(m.tokens / (t.tokens || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-[12px] text-muted-foreground">No data in this period.</div>
        )}
      </Panel>
    </div>
  );
}
