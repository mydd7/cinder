import { HugeiconsIcon } from "@hugeicons/react";
import { evaluateTracks, globalRank } from "@/lib/badges";
import { ICON } from "@/lib/icons";
import type { Summary } from "@/lib/types";
import { Card } from "@/components/Primitives";

export function Badges({ full }: { full: Summary }) {
  const tracks = evaluateTracks(full);
  const rank = globalRank(tracks);

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="flex-row items-center gap-5 rounded-3xl px-6 py-5">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-[var(--brand)]"
          style={{
            background: "linear-gradient(145deg, color-mix(in oklch, var(--brand) 34%, transparent), color-mix(in oklch, var(--brand) 8%, transparent))",
            boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--brand) 26%, transparent)"
          }}
        >
          <HugeiconsIcon icon={ICON.badges} size={30} strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[20px] font-semibold tracking-tight">{rank.rank}</span>
            <span className="text-[12px] text-muted-foreground">Level {rank.totalLevels}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-700" style={{ width: `${(rank.progress * 100).toFixed(0)}%` }} />
          </div>
          <div className="mt-1.5 text-[11.5px] text-muted-foreground">
            {rank.nextRank ? (
              <>
                {rank.atNext! - rank.totalLevels} levels to <span className="font-medium text-foreground">{rank.nextRank}</span>
              </>
            ) : (
              "Max rank reached"
            )}{" "}
            · {rank.maxTierTracks}/{rank.trackCount} tracks at tier VI+
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {tracks.map((t) => (
          <div
            key={t.id}
            className="flex gap-3.5 rounded-3xl bg-card p-[15px] shadow-md ring-1 ring-foreground/10 transition-transform hover:-translate-y-0.5"
            style={{ ["--tint" as string]: t.tint }}
          >
            <div
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] text-[var(--tint)]"
              style={{
                background: "linear-gradient(145deg, color-mix(in oklch, var(--tint) 30%, transparent), color-mix(in oklch, var(--tint) 7%, transparent))",
                boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--tint) 22%, transparent)"
              }}
            >
              <HugeiconsIcon icon={ICON[t.icon]} size={21} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{t.level > 0 ? t.tierLabel : t.name}</span>
                <span className="shrink-0 text-[11px] tnum text-muted-foreground">{t.valueText}</span>
              </div>
              <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(t.progress * 100).toFixed(0)}%`, background: "var(--tint)" }} />
              </div>
              <div className="mt-1.5 text-[10.5px] text-muted-foreground tnum">
                {t.level > 0 ? `Tier ${t.level} · ` : ""}next at {t.nextText}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
