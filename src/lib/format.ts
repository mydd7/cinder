export const fmt = {
  compact(n: number): string {
    n = n || 0;
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(Math.round(n));
  },
  int(n: number): string {
    return Math.round(n || 0).toLocaleString("en-US");
  },
  usd(n: number): string {
    n = n || 0;
    if (n >= 1000) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (n >= 100) return "$" + n.toFixed(1);
    return "$" + n.toFixed(2);
  },
  pct(n: number): string {
    return (n * 100).toFixed(n >= 0.1 ? 0 : 1) + "%";
  },
  dayKey(d: Date | string | number): string {
    const x = new Date(d);
    return (
      x.getFullYear() +
      "-" +
      String(x.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(x.getDate()).padStart(2, "0")
    );
  },
  dayLabel(key: string): string {
    return new Date(key + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  },
  monthShort(d: Date): string {
    return d.toLocaleDateString("en-US", { month: "short" });
  },
  modelShort(m: string): string {
    if (!m) return "unknown";
    if (m === "cursor-auto" || m === "default") return "Auto";
    return m
      .replace(/^claude-/, "")
      .replace(/-\d{8}$/, "")
      .replace(/^anthropic\//, "")
      .replace(/-high-thinking$/, "")
      .replace(/-thinking$/, "");
  }
};
