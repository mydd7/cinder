import { ThemeMenu } from "./ThemeMenu";
import { WindowControls } from "./WindowControls";
import type { Mode } from "@/lib/themes";

interface Props {
  themeId: string;
  mode: Mode;
  onTheme: (id: string) => void;
  onMode: (mode: Mode) => void;
}

export function TitleBar({ themeId, mode, onTheme, onMode }: Props) {
  return (
    <header className="drag flex h-full items-center gap-2 border-b border-border/50 bg-background pr-1 pl-3 select-none">
      <span
        className="grid h-[21px] w-[21px] place-items-center rounded-[7px] font-mono text-[11px] font-semibold text-white shadow-sm"
        style={{ background: "linear-gradient(140deg, var(--brand), var(--brand-2))" }}
      >
        {"A\\"}
      </span>
      <span className="text-[12.5px] font-semibold tracking-tight">Usage</span>

      <div className="drag h-full flex-1" />

      <ThemeMenu themeId={themeId} mode={mode} onTheme={onTheme} onMode={onMode} />
      <span className="mx-0.5 h-4 w-px shrink-0 bg-border/70" />
      <WindowControls />
    </header>
  );
}
