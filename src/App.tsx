import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { filterPeriod, summarize } from "@/lib/aggregate";
import { applyTheme, DEFAULT_THEME, paletteOf, type Mode } from "@/lib/themes";
import { useUsage } from "@/hooks/useUsage";
import { TitleBar } from "@/components/TitleBar";
import { NavBar } from "@/components/NavBar";
import { Overview } from "@/views/Overview";
import { Activity } from "@/views/Activity";
import { Models } from "@/views/Models";
import { Projects } from "@/views/Projects";
import { Providers } from "@/views/Providers";
import { Badges } from "@/views/Badges";

export type ViewId = "overview" | "activity" | "models" | "projects" | "providers" | "badges";

const PERIODS = [
  { d: 7, label: "7D" },
  { d: 30, label: "30D" },
  { d: 90, label: "90D" },
  { d: 0, label: "All" }
];

const TITLES: Record<ViewId, string> = {
  overview: "Overview",
  activity: "Activity",
  models: "Models",
  projects: "Projects",
  providers: "Providers",
  badges: "Badges"
};

export function App() {
  const { data, loading, reload } = useUsage();
  const [view, setView] = useState<ViewId>("overview");
  const [period, setPeriod] = useState(30);
  const [themeId, setThemeId] = useState(() => localStorage.getItem("au-theme-id") || DEFAULT_THEME);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("au-mode") === "light" ? "light" : "dark"));

  useEffect(() => {
    applyTheme(themeId, mode);
    localStorage.setItem("au-theme-id", themeId);
    localStorage.setItem("au-mode", mode);
    localStorage.setItem("au-bg", paletteOf(themeId, mode).bg);
  }, [themeId, mode]);

  const entries = data?.entries ?? [];
  const full = useMemo(() => summarize(entries), [entries]);
  const periodic = view === "overview" || view === "activity" || view === "models" || view === "projects";
  const periodEntries = useMemo(() => (periodic ? filterPeriod(entries, period) : entries), [entries, period, periodic]);
  const sum = useMemo(() => (periodic ? summarize(periodEntries) : full), [periodEntries, periodic, full]);

  const hasData = entries.length > 0;

  return (
    <div className="grid h-full grid-rows-[34px_50px_1fr] overflow-hidden">
      <TitleBar themeId={themeId} mode={mode} onTheme={setThemeId} onMode={setMode} />
      <NavBar view={view} onView={setView} />

      <main className="min-h-0 overflow-y-auto bg-background px-6 py-5 pb-10">
        <div className="mb-[18px] flex items-center justify-between gap-4">
          <h1 className="text-[19px] font-[620] tracking-[-0.025em]">{TITLES[view]}</h1>
          <div className="flex items-center gap-2">
            {periodic && hasData && (
              <div className="flex rounded-md bg-card p-[3px] ring-1 ring-foreground/10">
                {PERIODS.map((p) => (
                  <button
                    key={p.d}
                    onClick={() => setPeriod(p.d)}
                    className={cn(
                      "rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors",
                      p.d === period ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => void reload()}
              aria-label="Rescan logs"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HugeiconsIcon icon={ICON.refresh} size={16} strokeWidth={1.8} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="grid h-[62vh] place-items-center gap-3.5 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-[var(--brand)]" />
            <div>Scanning local usage logs…</div>
          </div>
        ) : !hasData ? (
          <div className="grid h-[60vh] place-items-center text-center text-muted-foreground">
            <div>
              <div className="mb-1.5 text-[15px] font-semibold text-foreground">No usage data found</div>
              {data?.error ? "Error: " + data.error : "Scanned Claude, Codex, OpenCode and 12 more tools. Use one, then press refresh."}
            </div>
          </div>
        ) : (
          <div key={view} className="terax-tab-in">
            {view === "overview" && <Overview sum={sum} period={period} />}
            {view === "activity" && <Activity sum={sum} full={full} entries={periodEntries} period={period} />}
            {view === "models" && <Models sum={sum} period={period} />}
            {view === "projects" && <Projects sum={sum} period={period} />}
            {view === "providers" && <Providers full={full} entries={entries} />}
            {view === "badges" && <Badges full={full} />}
          </div>
        )}
      </main>
    </div>
  );
}
