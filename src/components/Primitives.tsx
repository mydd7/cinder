import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";
import type { IconKey } from "@/lib/icons";

export function Panel({
  title,
  hint,
  children,
  className,
  bodyClass
}: {
  title?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <Card className={cn("gap-0 rounded-3xl p-[18px] py-[18px]", className)}>
      {(title || hint) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-[13.5px] font-semibold tracking-tight">{title}</h3>}
          {hint && <span className="text-[11.5px] text-muted-foreground">{hint}</span>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </Card>
  );
}

export function StatCard({
  icon,
  label,
  value,
  unit,
  sub
}: {
  icon: IconKey;
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-3xl p-4 py-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
        <Icon name={icon} size={15} className="text-[var(--brand)]" />
        {label}
      </div>
      <div className="text-[25px] font-[640] leading-[1.1] tracking-[-0.035em] tnum">
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function BarRow({
  name,
  value,
  max,
  color,
  amt
}: {
  name: string;
  value: number;
  max: number;
  color: string;
  amt: ReactNode;
}) {
  const w = max ? (value / max) * 100 : 0;
  return (
    <div className="grid grid-cols-[130px_1fr_auto] items-center gap-3">
      <div className="truncate text-[12.5px]">{name}</div>
      <div className="h-[7px] overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${w.toFixed(1)}%`, background: color }} />
      </div>
      <div className="min-w-[108px] text-right text-[12px] text-muted-foreground tnum">{amt}</div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3.5 flex flex-wrap justify-center gap-3.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}
