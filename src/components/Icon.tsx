import { HugeiconsIcon } from "@hugeicons/react";
import { ICON, type IconKey } from "@/lib/icons";

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
  className
}: {
  name: IconKey;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return <HugeiconsIcon icon={ICON[name]} size={size} strokeWidth={strokeWidth} className={className} />;
}
