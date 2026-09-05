const EMBER =
  "M44.01 15.99Q47 13 50.51 15.86L70.49 32.14Q74 35 73.22 40.07L68.78 68.93Q68 74 65.01 75.95L47.99 87.05Q45 89 42.53 86.66L28.47 73.34Q26 71 25.74 66.45L24.26 40.55Q24 36 26.99 33.01Z";
const SPARK =
  "M78.712 13.616Q79 12.8 79.288 13.616L81.116 18.78Q81.404 19.596 82.22 19.884L87.384 21.712Q88.2 22 87.384 22.288L82.22 24.116Q81.404 24.404 81.116 25.22L79.288 30.384Q79 31.2 78.712 30.384L76.884 25.22Q76.596 24.404 75.78 24.116L70.616 22.288Q69.8 22 70.616 21.712L75.78 19.884Q76.596 19.596 76.884 18.78Z";

export function Logo({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <path d={EMBER} fill="currentColor" />
      <path d={SPARK} fill="currentColor" />
    </svg>
  );
}
