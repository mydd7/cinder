import { useId, useState } from "react";
import { useMeasure } from "@/hooks/useMeasure";
import { fmt } from "@/lib/format";
import type { DayPoint } from "@/lib/types";
import { ChartTip } from "./ChartTip";

const COL = { input: "var(--data-1)", output: "var(--data-2)", cache: "var(--muted-foreground)" };
const H = 240;
const PAD = { l: 46, r: 14, t: 14, b: 24 };

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x} ${pts[0].y}` : "";
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const t = 0.18;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function AreaChart({ series }: { series: DayPoint[] }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const gid = useId().replace(/:/g, "");
  const W = width || 640;
  const n = series.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const totals = series.map((d) => d.input + d.output + d.cacheWrite + d.cacheRead);
  const max = Math.max(1, ...totals);
  const x = (i: number) => (n <= 1 ? PAD.l + plotW / 2 : PAD.l + (i * plotW) / (n - 1));
  const y = (v: number) => PAD.t + plotH * (1 - v / max);

  const pts = series.map((_, i) => ({ x: x(i), y: y(totals[i]) }));
  const line = smoothPath(pts);
  const area = line + `L${x(n - 1).toFixed(1)} ${(PAD.t + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(PAD.t + plotH).toFixed(1)} Z`;

  const labelStep = Math.max(1, Math.ceil(n / 6));
  const hd = hover ? series[hover.i] : null;
  const hTot = hd ? totals[hover!.i] : 0;

  function onMove(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / (rect.width || W)) * W;
    let i = n <= 1 ? 0 : Math.round(((relX - PAD.l) / plotW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover({ i, x: e.clientX, y: e.clientY });
  }

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMove}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.42} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((g) => {
          const yy = y(max * g);
          return (
            <g key={g}>
              <line x1={PAD.l} y1={yy} x2={W - PAD.r} y2={yy} stroke="var(--border)" strokeDasharray="2 5" />
              <text x={PAD.l - 8} y={yy + 3} textAnchor="end" className="fill-[var(--muted-foreground)]" fontSize={10} opacity={0.7}>
                {fmt.compact(max * g)}
              </text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2} />
        {series.map((d, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={x(i)} y={H - 7} textAnchor="middle" className="fill-[var(--muted-foreground)]" fontSize={10} opacity={0.7}>
              {fmt.dayLabel(d.key)}
            </text>
          ) : null
        )}
        {hd && (
          <>
            <line x1={x(hover!.i)} y1={PAD.t} x2={x(hover!.i)} y2={PAD.t + plotH} stroke="var(--brand)" strokeWidth={1} strokeOpacity={0.5} />
            <circle cx={x(hover!.i)} cy={y(hTot)} r={4} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hd && (
        <ChartTip
          x={hover!.x}
          y={hover!.y}
          title={fmt.dayLabel(hd.key)}
          rows={[
            { label: "Input", value: fmt.compact(hd.input), color: COL.input },
            { label: "Output", value: fmt.compact(hd.output), color: COL.output },
            { label: "Cache", value: fmt.compact(hd.cacheWrite + hd.cacheRead), color: COL.cache },
            { label: "Total", value: fmt.compact(hTot) },
            { label: "Requests", value: fmt.int(hd.requests) },
            { label: "Cost", value: fmt.usd(hd.cost) }
          ]}
        />
      )}
    </div>
  );
}
