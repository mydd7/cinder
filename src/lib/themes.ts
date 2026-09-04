export type Mode = "dark" | "light";

export interface Palette {
  bg: string;
  fg: string;
  surface: string;
  muted: string;
  mutedFg: string;
  brand: string;
  brand2: string;
  data: [string, string, string, string, string];
  destructive: string;
}

export interface Theme {
  id: string;
  label: string;
  dark: Palette;
  light: Palette;
}

export const THEMES: Theme[] = [
  {
    id: "claude",
    label: "Claude",
    dark: {
      bg: "#1f1e1d",
      fg: "#f5f4ee",
      surface: "#262624",
      muted: "#2a2926",
      mutedFg: "#b0a89a",
      brand: "#d97757",
      brand2: "#e8b87a",
      data: ["#d97757", "#b3c98c", "#e8b87a", "#cf9bb0", "#8fb0d9"],
      destructive: "#e5634d"
    },
    light: {
      bg: "#faf9f5",
      fg: "#3d3a2f",
      surface: "#ffffff",
      muted: "#efece4",
      mutedFg: "#73705f",
      brand: "#c15f3c",
      brand2: "#b07a2a",
      data: ["#c15f3c", "#5a7d3c", "#b07a2a", "#a05278", "#3a6ea5"],
      destructive: "#c0392b"
    }
  },
  {
    id: "slate",
    label: "Slate",
    dark: {
      bg: "#14171a",
      fg: "#e9edf1",
      surface: "#1c2024",
      muted: "#262c32",
      mutedFg: "#97a2ad",
      brand: "#5b9df0",
      brand2: "#7fb0f5",
      data: ["#5b9df0", "#63c19b", "#e0b062", "#c58bd9", "#e58a8a"],
      destructive: "#e5634d"
    },
    light: {
      bg: "#f7f8fa",
      fg: "#1e2329",
      surface: "#ffffff",
      muted: "#eceef1",
      mutedFg: "#5c656e",
      brand: "#2f7de0",
      brand2: "#4a90e2",
      data: ["#2f7de0", "#2f9e6e", "#c98a2b", "#9a5ec0", "#d15a5a"],
      destructive: "#c0392b"
    }
  },
  {
    id: "ocean",
    label: "Ocean",
    dark: {
      bg: "#0e1719",
      fg: "#e6f2f3",
      surface: "#142023",
      muted: "#1d2d31",
      mutedFg: "#93aeb2",
      brand: "#2dd4bf",
      brand2: "#5eead4",
      data: ["#2dd4bf", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185"],
      destructive: "#f87171"
    },
    light: {
      bg: "#f4faf9",
      fg: "#12292b",
      surface: "#ffffff",
      muted: "#e4f0ef",
      mutedFg: "#4d6b6e",
      brand: "#0d9488",
      brand2: "#14b8a6",
      data: ["#0d9488", "#0284c7", "#7c3aed", "#d97706", "#e11d48"],
      destructive: "#dc2626"
    }
  },
  {
    id: "emerald",
    label: "Emerald",
    dark: {
      bg: "#101711",
      fg: "#e9f3ea",
      surface: "#16211a",
      muted: "#1f2d22",
      mutedFg: "#9fb4a3",
      brand: "#34d399",
      brand2: "#6ee7b7",
      data: ["#34d399", "#60a5fa", "#fbbf24", "#c084fc", "#fb7185"],
      destructive: "#f87171"
    },
    light: {
      bg: "#f5faf6",
      fg: "#16281b",
      surface: "#ffffff",
      muted: "#e6f1e8",
      mutedFg: "#4f6a55",
      brand: "#059669",
      brand2: "#10b981",
      data: ["#059669", "#2563eb", "#d97706", "#9333ea", "#e11d48"],
      destructive: "#dc2626"
    }
  },
  {
    id: "amethyst",
    label: "Amethyst",
    dark: {
      bg: "#16121c",
      fg: "#f0ecf6",
      surface: "#1e1826",
      muted: "#281f33",
      mutedFg: "#b0a3bf",
      brand: "#a78bfa",
      brand2: "#c4b5fd",
      data: ["#a78bfa", "#f0abfc", "#5eead4", "#fbbf24", "#fb7185"],
      destructive: "#f87171"
    },
    light: {
      bg: "#faf7fd",
      fg: "#271e33",
      surface: "#ffffff",
      muted: "#efe9f5",
      mutedFg: "#665a75",
      brand: "#7c3aed",
      brand2: "#9061f0",
      data: ["#7c3aed", "#c026d3", "#0d9488", "#d97706", "#e11d48"],
      destructive: "#dc2626"
    }
  },
  {
    id: "rose",
    label: "Rose",
    dark: {
      bg: "#1a1214",
      fg: "#f7ecef",
      surface: "#241a1d",
      muted: "#322329",
      mutedFg: "#c0a5ac",
      brand: "#fb7185",
      brand2: "#fda4af",
      data: ["#fb7185", "#f0abfc", "#a78bfa", "#fbbf24", "#5eead4"],
      destructive: "#f43f5e"
    },
    light: {
      bg: "#fdf6f7",
      fg: "#331e24",
      surface: "#ffffff",
      muted: "#f4e6ea",
      mutedFg: "#75565e",
      brand: "#e11d48",
      brand2: "#f43f5e",
      data: ["#e11d48", "#c026d3", "#7c3aed", "#d97706", "#0d9488"],
      destructive: "#dc2626"
    }
  }
];

export const DEFAULT_THEME = "claude";

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function paletteOf(id: string, mode: Mode): Palette {
  const t = themeById(id);
  return mode === "dark" ? t.dark : t.light;
}

export function applyTheme(id: string, mode: Mode): void {
  const p = paletteOf(id, mode);
  const r = document.documentElement;
  const set = (k: string, v: string) => r.style.setProperty(k, v);
  set("--background", p.bg);
  set("--foreground", p.fg);
  set("--card", p.surface);
  set("--card-foreground", p.fg);
  set("--popover", p.surface);
  set("--popover-foreground", p.fg);
  set("--primary", p.brand);
  set("--primary-foreground", mode === "dark" ? p.bg : "#ffffff");
  set("--secondary", p.muted);
  set("--secondary-foreground", p.fg);
  set("--muted", p.muted);
  set("--muted-foreground", p.mutedFg);
  set("--accent", p.muted);
  set("--accent-foreground", p.fg);
  set("--destructive", p.destructive);
  set("--brand", p.brand);
  set("--brand-2", p.brand2);
  p.data.forEach((c, i) => set(`--data-${i + 1}`, c));
  r.classList.toggle("dark", mode === "dark");
  r.classList.toggle("light", mode === "light");
  r.style.backgroundColor = p.bg;
}
