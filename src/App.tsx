import { useCallback, useEffect, useMemo, useState } from "react";
import type { SnapshotInfo } from "@/lib/types";
import { HugeiconsIcon } from "@hugeicons/react";
import { ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { filterPeriod, summarize } from "@/lib/aggregate";
import { readPref, writePref } from "@/lib/prefs";
import { applyTheme, DEFAULT_THEME, paletteOf, type Mode } from "@/lib/themes";
import { useUsage } from "@/hooks/useUsage";
import { useCalls } from "@/hooks/useCalls";
import { TitleBar } from "@/components/TitleBar";
import { NavBar, VIEW_ORDER } from "@/components/NavBar";
import { ScanGate } from "@/components/ScanGate";
import { Overview } from "@/views/Overview";
import { Activity } from "@/views/Activity";
import { Calls } from "@/views/Calls";
import { Models } from "@/views/Models";
import { Projects } from "@/views/Projects";
import { Providers } from "@/views/Providers";
import { Badges } from "@/views/Badges";
import { Sessions } from "@/views/Sessions";

export type ViewId = "overview" | "activity" | "calls" | "models" | "projects" | "providers" | "badges" | "sessions";

const PERIODS = [
  { d: 7, label: "7D" },
  { d: 30, label: "30D" },
  { d: 90, label: "90D" },
  { d: 0, label: "All" }
];

const TITLES: Record<ViewId, string> = {
  overview: "Overview",
  activity: "Activity",
  calls: "Calls",
  models: "Models",
  projects: "Projects",
  providers: "Providers",
  badges: "Badges",
  sessions: "Sessions"
};

function initialPeriod(): number {
  const saved = Number(readPref("period"));
  return PERIODS.some((p) => p.d === saved) ? saved : 30;
}

export function App() {
  const { data, loading, progress, reload, restore, prefetch, cancel } = useUsage();
  const { data: callsData, loading: callsLoading, reload: reloadCalls, restore: restoreCalls } = useCalls();
  const [boot, setBoot] = useState<"checking" | "gate" | "ready">("checking");
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [view, setView] = useState<ViewId>("overview");
  const [period, setPeriod] = useState(initialPeriod);
  const [themeId, setThemeId] = useState(() => readPref("theme-id") || DEFAULT_THEME);
  const [mode, setMode] = useState<Mode>(() => (readPref("mode") === "light" ? "light" : "dark"));

  const startScan = useCallback(async () => {
    setBoot("ready");
    setSnapshot(null);
    await window.cinder?.clearSnapshot().catch(() => {});
    const done = await reload();
    if (!done) {
      setBoot("gate");
      return;
    }
    void reloadCalls();
  }, [reload, reloadCalls]);

  const openSnapshot = useCallback(async () => {
    const ok = await restore();
    if (!ok) {
      void startScan();
      return;
    }
    await restoreCalls();
    setBoot("ready");
  }, [restore, restoreCalls, startScan]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const info = await window.cinder?.snapshotInfo().catch(() => null);
      if (!alive) return;
      if (info && info.entries > 0) {
        setSnapshot(info);
        setBoot("gate");
        prefetch();
      } else {
        void startScan();
      }
    })();
    return () => {
      alive = false;
    };
  }, [startScan, prefetch]);

  useEffect(() => {
    if (view === "calls" && boot === "ready" && !callsData && !callsLoading) void reloadCalls();
  }, [view, boot, callsData, callsLoading, reloadCalls]);

  useEffect(() => {
    applyTheme(themeId, mode);
    writePref("theme-id", themeId);
    writePref("mode", mode);
    window.cinder?.setBackground(paletteOf(themeId, mode).bg);
  }, [themeId, mode]);

  useEffect(() => {
    writePref("period", String(period));
  }, [period]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        void startScan();
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= VIEW_ORDER.length) {
        e.preventDefault();
        setView(VIEW_ORDER[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startScan]);

  useEffect(() => {
    return window.cinder?.onMenuRescan(() => void startScan());
  }, [startScan]);

  const entries = data?.entries ?? [];
  const full = useMemo(() => summarize(entries), [entries]);
  const periodic = view === "overview" || view === "activity" || view === "models" || view === "projects" || view === "sessions";
  const periodEntries = useMemo(() => (periodic ? filterPeriod(entries, period) : entries), [entries, period, periodic]);
  const sum = useMemo(() => (periodic ? summarize(periodEntries) : full), [periodEntries, periodic, full]);

  const hasData = entries.length > 0;

  return (
    <div className="grid h-full grid-rows-[34px_50px_1fr] overflow-hidden">
      <TitleBar themeId={themeId} mode={mode} onTheme={setThemeId} onMode={setMode} />
      <NavBar view={view} onView={setView} />

      <main className="min-h-0 overflow-y-auto bg-background px-6 py-5 pb-10 select-text">
        <div className="mb-[18px] flex items-center justify-between gap-4">
          <h1 className="text-[19px] font-[620] tracking-[-0.025em]">{TITLES[view]}</h1>
          <div className={cn("flex items-center gap-2", boot !== "ready" && "hidden")}>
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
              onClick={() => void startScan()}
              disabled={loading}
              aria-label="Rescan logs"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none"
            >
              <HugeiconsIcon icon={ICON.refresh} size={16} strokeWidth={1.8} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {boot !== "ready" ? (
          boot === "gate" ? (
            <ScanGate info={snapshot} onRestore={() => void openSnapshot()} onScan={() => void startScan()} />
          ) : null
        ) : loading && !data ? (
          <div className="grid h-[62vh] place-items-center">
            <div className="w-[320px]">
              <div className="mb-2.5 flex items-baseline justify-between text-[12.5px] text-muted-foreground">
                <span>
                  {progress.label ? `Scanning ${progress.label}…` : "Scanning local usage logs…"}
                  {progress.files ? ` · ${progress.files.toLocaleString()} files` : ""}
                </span>
                <span className="tnum">{progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <button
                onClick={() => void cancel()}
                className="mt-3.5 w-full rounded-xl px-4 py-2 text-[12.5px] font-medium text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel scan
              </button>
            </div>
          </div>
        ) : !hasData ? (
          <div className="grid h-[60vh] place-items-center text-center text-muted-foreground">
            <div>
              <div className="mb-1.5 text-[15px] font-semibold text-foreground">No usage data found</div>
              {data?.error
                ? "Error: " + data.error
                : `Scanned ${data?.catalog?.length ?? 0} local tools. Use one, then press refresh.`}
            </div>
          </div>
        ) : periodic && !periodEntries.length ? (
          <div className="grid h-[60vh] place-items-center text-center text-muted-foreground">
            No data in this period.
          </div>
        ) : (
          <div key={view} className="terax-tab-in">
            {view === "overview" && <Overview sum={sum} period={period} />}
            {view === "activity" && <Activity sum={sum} full={full} entries={periodEntries} period={period} />}
            {view === "calls" && <Calls calls={callsData} />}
            {view === "models" && <Models sum={sum} period={period} />}
            {view === "projects" && <Projects sum={sum} period={period} />}
            {view === "sessions" && <Sessions entries={periodEntries} />}
            {view === "providers" && <Providers full={full} entries={entries} />}
            {view === "badges" && <Badges full={full} />}
          </div>
        )}
      </main>
    </div>
  );
}
