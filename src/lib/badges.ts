import { fmt } from "./format";
import type { IconKey } from "./icons";
import type { Summary } from "./types";
import { streaks } from "./aggregate";

const TINT = {
  brand: "var(--brand)",
  green: "var(--data-2)",
  amber: "var(--data-3)",
  mauve: "var(--data-4)",
  blue: "var(--data-5)"
};

type Kind = "int" | "compact" | "usd" | "days";

interface TrackDef {
  id: string;
  name: string;
  icon: IconKey;
  tint: string;
  kind: Kind;
  th: number[];
  val: (s: Summary, extra: Extra) => number;
}

interface Extra {
  bestStreak: number;
}

const TRACKS: TrackDef[] = [
  { id: "requests", name: "Requests", icon: "b_century", tint: TINT.brand, kind: "int", th: [100, 500, 1e3, 5e3, 1e4, 5e4, 1e5, 5e5, 1e6], val: (s) => s.totals.requests },
  { id: "tokens", name: "Tokens", icon: "b_millionaire", tint: TINT.green, kind: "compact", th: [1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12], val: (s) => s.totals.tokens },
  { id: "output", name: "Output", icon: "output", tint: TINT.amber, kind: "compact", th: [1e5, 1e6, 1e7, 5e7, 1e8, 5e8, 1e9], val: (s) => s.totals.output },
  { id: "cache", name: "Cache reads", icon: "b_cache", tint: TINT.green, kind: "compact", th: [1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12], val: (s) => s.totals.cacheRead },
  { id: "cost", name: "Spend", icon: "b_spender", tint: TINT.mauve, kind: "usd", th: [10, 50, 100, 500, 1e3, 5e3, 1e4, 5e4], val: (s) => s.totals.cost },
  { id: "models", name: "Models", icon: "b_polyglot", tint: TINT.blue, kind: "int", th: [2, 3, 5, 8, 12, 16, 24], val: (s) => s.models.length },
  { id: "projects", name: "Projects", icon: "b_explorer", tint: TINT.mauve, kind: "int", th: [2, 5, 10, 20, 40, 80, 160], val: (s) => s.projects.length },
  { id: "days", name: "Active days", icon: "b_consistent", tint: TINT.green, kind: "int", th: [7, 30, 90, 180, 365, 730], val: (s) => s.activeDays },
  { id: "streak", name: "Streak", icon: "b_streak", tint: TINT.amber, kind: "days", th: [3, 7, 14, 30, 60, 100, 180, 365], val: (_s, e) => e.bestStreak }
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
function roman(n: number): string {
  return n <= ROMAN.length ? ROMAN[n - 1] : String(n);
}

function fmtBy(kind: Kind, n: number): string {
  if (kind === "int") return fmt.int(n);
  if (kind === "usd") return fmt.usd(n);
  if (kind === "days") return n + "d";
  return fmt.compact(n);
}

function nextThreshold(th: number[], level: number): number {
  if (level < th.length) return th[level];
  return th[th.length - 1] * Math.pow(10, level - th.length + 1);
}

export interface TrackResult {
  id: string;
  name: string;
  icon: IconKey;
  tint: string;
  level: number;
  tierLabel: string;
  value: number;
  valueText: string;
  prev: number;
  next: number;
  nextText: string;
  progress: number;
  started: boolean;
}

export function evaluateTracks(sum: Summary): TrackResult[] {
  const st = streaks(sum.byDay);
  const extra: Extra = { bestStreak: Math.max(st.current, st.longest) };
  return TRACKS.map((t) => {
    const value = t.val(sum, extra);
    let level = 0;
    while (value >= (level < t.th.length ? t.th[level] : nextThreshold(t.th, level))) level++;
    const prev = level === 0 ? 0 : nextThreshold(t.th, level - 1);
    const next = nextThreshold(t.th, level);
    const progress = Math.max(0, Math.min(1, (value - prev) / (next - prev)));
    return {
      id: t.id,
      name: t.name,
      icon: t.icon,
      tint: t.tint,
      level,
      tierLabel: level === 0 ? "Unranked" : `${t.name} ${roman(level)}`,
      value,
      valueText: fmtBy(t.kind, value),
      prev,
      next,
      nextText: fmtBy(t.kind, next),
      progress,
      started: value > 0
    };
  });
}

const RANKS = ["Novice", "Initiate", "Apprentice", "Adept", "Specialist", "Expert", "Veteran", "Master", "Grandmaster", "Elite", "Legend", "Mythic", "Ascendant", "Immortal"];
const RANK_AT = [0, 4, 9, 15, 22, 30, 39, 49, 60, 72, 85, 99, 114, 130];

export interface GlobalRank {
  rank: string;
  nextRank: string | null;
  totalLevels: number;
  rankIndex: number;
  atCurrent: number;
  atNext: number | null;
  progress: number;
  maxTierTracks: number;
  trackCount: number;
}

export function globalRank(tracks: TrackResult[]): GlobalRank {
  const totalLevels = tracks.reduce((a, t) => a + t.level, 0);
  let idx = 0;
  while (idx + 1 < RANK_AT.length && totalLevels >= RANK_AT[idx + 1]) idx++;
  const beyond = totalLevels >= RANK_AT[RANK_AT.length - 1];
  const atCurrent = RANK_AT[idx];
  const atNext = beyond ? null : RANK_AT[idx + 1];
  const progress = atNext === null ? 1 : Math.max(0, Math.min(1, (totalLevels - atCurrent) / (atNext - atCurrent)));
  return {
    rank: RANKS[idx],
    nextRank: beyond ? null : RANKS[idx + 1],
    totalLevels,
    rankIndex: idx,
    atCurrent,
    atNext,
    progress,
    maxTierTracks: tracks.filter((t) => t.level >= 6).length,
    trackCount: tracks.length
  };
}
