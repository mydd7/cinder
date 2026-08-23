import { useMemo, useState } from "react";
import { heatmap } from "@/lib/aggregate";
import { fmt } from "@/lib/format";
import { useMeasure } from "@/hooks/useMeasure";
import type { Entry } from "@/lib/types";
import { ChartTip } from "./ChartTip";

export const HEAT_LEVELS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const GAP = 3;

export function HeatLegend() {
  return (
    <div className="mt-3.5 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
      <span>Less</span>
      {HEAT_LEVELS.map((l, i) => (
        <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: l }} />
      ))}
      <span>More</span>
    </div>
  );
}

export function Heatmap({
  entries,
  days,
  maxCell,
  showLegend = true
}: {
  entries: Entry[];
  days: number;
  maxCell?: number;
  showLegend?: boolean;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const hm = useMemo(() => heatmap(entries, days), [entries, days]);
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);
  const avail = Math.max(240, (width || 720) - 2);

  const calendar = days > 0 && days <= 45;

  function cellProps(c: (typeof hm.cells)[number], cell: number, radius: number, key: number) {
    if (c.future) return <div key={key} style={{ width: cell, height: cell }} />;
    const lvl = c.count > 0 ? Math.min(4, 1 + Math.floor((c.count / (hm.max || 1)) * 3.99)) : 0;
    return (
      <div
        key={key}
        style={{ width: cell, height: cell, borderRadius: radius, background: HEAT_LEVELS[lvl] }}
        onMouseMove={(e) => setHover({ text: c.count + " request" + (c.count === 1 ? "" : "s") + " · " + fmt.dayLabel(c.key), x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHover(null)}
      />
    );
  }

  const legend = showLegend ? <HeatLegend /> : null;

  if (calendar) {
    let cell = Math.floor((avail - 6 * GAP) / 7);
    cell = Math.max(Math.min(16, maxCell ?? 16), Math.min(cell, maxCell ?? 46));
    const radius = Math.max(4, Math.round(cell * 0.22));
    const blockW = 7 * cell + 6 * GAP;
    return (
      <div ref={ref} className="w-full overflow-x-auto">
        <div className="mx-auto" style={{ width: blockW }}>
          <div className="mb-1.5 grid text-center text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(7, ${cell}px)`, gap: `${GAP}px` }}>
            {WD.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-flow-row" style={{ gridTemplateColumns: `repeat(7, ${cell}px)`, gap: `${GAP}px` }}>
            {hm.cells.map((c, i) => cellProps(c, cell, radius, i))}
          </div>
        </div>
        {legend}
        {hover && <ChartTip x={hover.x} y={hover.y} title={hover.text} rows={[]} />}
      </div>
    );
  }

  const cols = Math.max(1, Math.ceil(hm.cells.length / 7));
  let cell = Math.floor((avail - (cols - 1) * GAP) / cols);
  cell = Math.max(Math.min(10, maxCell ?? 10), Math.min(cell, maxCell ?? 30));
  const step = cell + GAP;
  const radius = Math.max(3, Math.round(cell * 0.24));
  const gridW = cols * cell + (cols - 1) * GAP;

  const months: { left: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < cols; w++) {
    const c = hm.cells[w * 7];
    if (!c) continue;
    if (c.date.getMonth() !== lastMonth) {
      months.push({ left: w * step, label: fmt.monthShort(c.date) });
      lastMonth = c.date.getMonth();
    }
  }

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <div className="mx-auto" style={{ width: gridW }}>
        <div className="relative mb-1.5 h-3.5 text-[10px] text-muted-foreground" style={{ width: gridW }}>
          {months.map((m, i) => (
            <span key={i} className="absolute top-0 whitespace-nowrap" style={{ left: m.left }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${cell}px)`, gap: `${GAP}px`, width: gridW }}>
          {hm.cells.map((c, i) => cellProps(c, cell, radius, i))}
        </div>
      </div>
      {legend}
      {hover && <ChartTip x={hover.x} y={hover.y} title={hover.text} rows={[]} />}
    </div>
  );
}
