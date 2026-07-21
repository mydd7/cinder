import { useState } from "react";
import { createPortal } from "react-dom";
import { THEMES, paletteOf, type Mode } from "@/lib/themes";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

interface Props {
  themeId: string;
  mode: Mode;
  onTheme: (id: string) => void;
  onMode: (mode: Mode) => void;
}

export function ThemeMenu({ themeId, mode, onTheme, onMode }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const active = paletteOf(themeId, mode);

  function toggle(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Theme"
        onClick={toggle}
        className="no-drag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span className="h-3.5 w-3.5 rounded-full ring-1 ring-foreground/20" style={{ background: `linear-gradient(140deg, ${active.brand}, ${active.brand2})` }} />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[91] w-[236px] rounded-2xl bg-popover p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)] ring-1 ring-foreground/10 terax-pill-in"
              style={{ top: pos.top, right: pos.right }}
            >
              <div className="mb-2 flex rounded-lg bg-muted p-[3px]">
                {(["dark", "light"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => onMode(m)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] py-1.5 text-[12px] font-medium capitalize transition-colors",
                      mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon name={m === "dark" ? "moon" : "sun"} size={13} />
                    {m}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {THEMES.map((t) => {
                  const p = paletteOf(t.id, mode);
                  const on = t.id === themeId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => onTheme(t.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] font-medium transition-colors ring-1",
                        on ? "bg-brand/10 text-foreground ring-brand/40" : "text-muted-foreground ring-transparent hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span className="flex shrink-0 gap-0.5">
                        <span className="h-4 w-2 rounded-l-[3px]" style={{ background: p.brand }} />
                        <span className="h-4 w-2 rounded-r-[3px]" style={{ background: p.data[1] }} />
                      </span>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
