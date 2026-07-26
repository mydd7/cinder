import { useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ICON, type IconKey } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/App";

const TABS: { id: ViewId; label: string; icon: IconKey }[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "models", label: "Models", icon: "models" },
  { id: "projects", label: "Projects", icon: "projects" },
  { id: "sessions", label: "Sessions", icon: "sessions" },
  { id: "providers", label: "Providers", icon: "providers" },
  { id: "badges", label: "Badges", icon: "badges" }
];

export const VIEW_ORDER: ViewId[] = TABS.map((t) => t.id);

interface Props {
  view: ViewId;
  onView: (v: ViewId) => void;
}

export function NavBar({ view, onView }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const el = btns.current[view];
    const box = wrap.current;
    if (!el || !box) return;
    const update = () => setPill({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [view]);

  return (
    <nav className="flex h-full items-center border-b border-border/70 bg-card px-3">
      <div ref={wrap} className="relative flex items-center gap-0.5">
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-lg bg-brand/[0.12]"
          style={{
            left: pill.left,
            width: pill.width,
            height: 34,
            opacity: pill.ready ? 1 : 0,
            transition: "left var(--dur-base) var(--ease-premium), width var(--dur-base) var(--ease-premium), opacity var(--dur-fast)"
          }}
        />
        {TABS.map((t) => {
          const active = t.id === view;
          return (
            <button
              key={t.id}
              ref={(el) => {
                btns.current[t.id] = el;
              }}
              type="button"
              onClick={() => onView(t.id)}
              className={cn(
                "no-drag relative z-10 flex h-[34px] items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
                active ? "text-brand" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={ICON[t.icon]} size={16} strokeWidth={active ? 2 : 1.7} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
