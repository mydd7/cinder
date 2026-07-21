import { useState } from "react";
import { useMeasure } from "@/hooks/useMeasure";
import { fmt } from "@/lib/format";
import { ChartTip } from "./ChartTip";

const H = 150;
const PAD = { l: 30, r: 8, t: 8, b: 20 };

export function HourlyBars({ byHour }: { byHour: { tokens: number; requests: number }[] }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const W = width || 640;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const max = Math.max(1, ...byHour.map((h) => h.tokens));
  const bw = plotW / 24;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {byHour.map((h, i) => {
          const bh = (h.tokens / max) * plotH;
          const bx = PAD.l + i * bw;
          const by = PAD.t + plotH - bh;
          const op = 0.25 + 0.65 * (h.tokens / max);
          return (
            <rect
              key={i}
              x={bx + 2}
              y={by}
              width={Math.max(1, bw - 4)}
              height={bh}
              rx={2}
              fill="var(--data-1)"
              fillOpacity={hover?.i === i ? 1 : op}
              onMouseMove={(e) => setHover({ i, x: e.clientX, y: e.clientY })}
            />
          );
        })}
        {byHour.map((_, i) =>
          i % 3 === 0 ? (
            <text key={i} x={PAD.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-[var(--muted-foreground)]" fontSize={10} opacity={0.7}>
              {i}
            </text>
          ) : null
        )}
      </svg>
      {hover && (
        <ChartTip
          x={hover.x}
          y={hover.y}
          title={String(hover.i).padStart(2, "0") + ":00"}
          rows={[
            { label: "Tokens", value: fmt.compact(byHour[hover.i].tokens) },
            { label: "Requests", value: fmt.int(byHour[hover.i].requests) }
          ]}
        />
      )}
    </div>
  );
}
