import { createPortal } from "react-dom";

export interface TipRow {
  label: string;
  value: string;
  color?: string;
}

export function ChartTip({ x, y, title, rows }: { x: number; y: number; title: string; rows: TipRow[] }) {
  const estW = 184;
  const estH = 14 + (title ? 20 : 0) + rows.length * 18;
  let left = x + 16;
  if (left + estW > window.innerWidth - 8) left = x - estW - 16;
  if (left < 8) left = 8;
  let top = y - 16 - estH;
  if (top < 8) top = y + 20;
  if (top + estH > window.innerHeight - 8) top = window.innerHeight - estH - 8;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] min-w-[132px] rounded-lg bg-popover p-2.5 text-[11px] shadow-[0_12px_34px_-8px_rgba(0,0,0,0.5)] ring-1 ring-foreground/10"
      style={{ left, top }}
    >
      <div className={rows.length ? "mb-1.5 text-[11.5px] font-semibold" : "text-[11.5px] font-semibold"}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-4 leading-[1.7] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />}
            {r.label}
          </span>
          <b className="tnum font-semibold text-foreground">{r.value}</b>
        </div>
      ))}
    </div>,
    document.body
  );
}
