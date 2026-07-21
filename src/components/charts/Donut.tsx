import { useState } from "react";
import { fmt } from "@/lib/format";
import { ChartTip } from "./ChartTip";

export interface DonutPart {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  parts,
  centerTop,
  centerBot,
  format = fmt.compact,
  valueLabel = "Tokens"
}: {
  parts: DonutPart[];
  centerTop: string;
  centerBot: string;
  format?: (n: number) => string;
  valueLabel?: string;
}) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const size = 148;
  const r = 58;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let off = 0;
  const segs = parts.map((p) => {
    const frac = p.value / total;
    const seg = { ...p, frac, dash: frac * c, offset: -off * c };
    off += frac;
    return seg;
  });

  return (
    <div className="relative" style={{ width: size, height: size }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={15} />
        {segs.map((s, i) =>
          s.frac > 0 ? (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={15}
              strokeDasharray={`${s.dash.toFixed(2)} ${c.toFixed(2)}`}
              strokeDashoffset={s.offset.toFixed(2)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseMove={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
            />
          ) : null
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[18px] font-semibold tracking-tight tnum">{centerTop}</div>
        <div className="text-[10px] text-muted-foreground">{centerBot}</div>
      </div>
      {hover && (
        <ChartTip
          x={hover.x}
          y={hover.y}
          title={segs[hover.i].label}
          rows={[
            { label: valueLabel, value: format(segs[hover.i].value) },
            { label: "Share", value: fmt.pct(segs[hover.i].frac) }
          ]}
        />
      )}
    </div>
  );
}
