import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

function Ctl({
  icon,
  label,
  onClick,
  size = 12,
  danger
}: {
  icon: (typeof ICON)[keyof typeof ICON];
  label: string;
  onClick: () => void;
  size?: number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "no-drag grid size-7 place-items-center rounded-md text-muted-foreground transition-colors",
        danger ? "hover:bg-destructive/15 hover:text-destructive" : "hover:bg-accent hover:text-foreground"
      )}
    >
      <HugeiconsIcon icon={icon} size={size} strokeWidth={2} />
    </button>
  );
}

export function WindowControls() {
  const [max, setMax] = useState(false);

  useEffect(() => {
    if (!window.au) return;
    void window.au.isMaximized().then(setMax);
    window.au.onWindowState(setMax);
  }, []);

  return (
    <div className="no-drag flex items-center gap-0.5 pr-1">
      <Ctl icon={ICON.minimize} label="Minimize" onClick={() => void window.au.minimize()} />
      <Ctl
        icon={max ? ICON.restore : ICON.maximize}
        label={max ? "Restore" : "Maximize"}
        onClick={() => void window.au.toggleMaximize().then(setMax)}
      />
      <Ctl icon={ICON.close} label="Close" size={14} onClick={() => void window.au.close()} danger />
    </div>
  );
}
