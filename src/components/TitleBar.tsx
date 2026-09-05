import { Logo } from "./Logo";
import { ThemeMenu } from "./ThemeMenu";
import { WindowControls } from "./WindowControls";
import { cn } from "@/lib/utils";
import type { Mode } from "@/lib/themes";

interface Props {
  themeId: string;
  mode: Mode;
  onTheme: (id: string) => void;
  onMode: (mode: Mode) => void;
}

const isMac = window.cinder?.platform === "darwin";

export function TitleBar({ themeId, mode, onTheme, onMode }: Props) {
  return (
    <header
      className={cn(
        "drag flex h-full items-center gap-2 border-b border-border/50 bg-background pr-1 select-none",
        isMac ? "pl-[78px]" : "pl-3"
      )}
      onDoubleClick={() => void window.cinder?.toggleMaximize()}
    >
      <Logo size={18} className="shrink-0 text-brand" />
      <span className="text-[12.5px] font-semibold tracking-tight">Cinder</span>

      <div className="drag h-full flex-1" />

      <ThemeMenu themeId={themeId} mode={mode} onTheme={onTheme} onMode={onMode} />
      {!isMac && (
        <>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />
          <WindowControls />
        </>
      )}
    </header>
  );
}
