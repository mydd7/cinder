import { Icon } from "./Icon";
import type { SnapshotInfo } from "@/lib/types";

function ago(iso: string) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return "unknown time";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ScanGate({
  info,
  onRestore,
  onScan
}: {
  info: SnapshotInfo | null;
  onRestore: () => void;
  onScan: () => void;
}) {
  return (
    <div className="grid h-[62vh] place-items-center">
      <div className="w-[380px] rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="mb-1.5 text-[15px] font-semibold">{info ? "Previous scan found" : "Scan cancelled"}</div>
        <div className="mb-5 text-[12.5px] text-muted-foreground">
          {info
            ? `Scanned ${ago(info.savedAt)} · ${info.entries.toLocaleString()} entries across ${info.sources} sources.`
            : "No cached scan is available. Run a scan to read your local logs."}
        </div>
        <div className="grid gap-2">
          {info && (
            <button
              onClick={onRestore}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              <Icon name="restore" size={15} />
              Open last scan
            </button>
          )}
          <button
            onClick={onScan}
            className={
              info
                ? "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-muted-foreground ring-1 ring-foreground/10 transition-colors hover:bg-accent hover:text-foreground"
                : "flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            }
          >
            <Icon name="refresh" size={15} />
            {info ? "Run a new scan" : "Run a scan"}
          </button>
        </div>
      </div>
    </div>
  );
}
