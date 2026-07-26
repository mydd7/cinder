const SHARD =
  "M39.718 22.112Q42.86 16.4 46.002 22.112L58.198 44.288Q61.34 50 58.198 55.712L46.002 77.888Q42.86 83.6 39.718 77.888L27.522 55.712Q24.38 50 27.522 44.288Z";
const SPARK =
  "M67.758 26.782Q68.9 25.64 70.042 26.782L74.478 31.218Q75.62 32.36 74.478 33.502L70.042 37.938Q68.9 39.08 67.758 37.938L63.322 33.502Q62.18 32.36 63.322 31.218Z";

export function Logo({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d={SHARD} fill="currentColor" />
      <path d={SPARK} fill="currentColor" />
    </svg>
  );
}
