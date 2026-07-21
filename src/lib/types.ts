export interface Entry {
  ts: string;
  source: string;
  model: string;
  provider: string;
  project: string;
  session: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  reasoning: number;
  cost: number;
  costInput: number;
  costOutput: number;
  costCacheWrite: number;
  costCacheRead: number;
}

export interface SourceMeta {
  source: string;
  dir: string;
  files: number;
  entries: number;
}

export interface SourceInfo {
  id: string;
  label: string;
}

export interface CollectResult {
  entries: Entry[];
  sources: SourceMeta[];
  catalog?: SourceInfo[];
  home: string;
  scannedAt: string;
  error?: string;
}

export interface Totals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  tokens: number;
  requests: number;
  cost: number;
}

export interface Bucket extends Totals {
  name: string;
  source?: string;
}

export interface DayPoint extends Totals {
  key: string;
}

export interface CostBy {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface Summary {
  totals: Totals;
  costBy: CostBy;
  byDay: Map<string, Totals>;
  byHour: { tokens: number; requests: number }[];
  models: Bucket[];
  projects: Bucket[];
  sources: Bucket[];
  sessions: number;
  activeDays: number;
  first: number | null;
  last: number | null;
  count: number;
}

declare global {
  interface Window {
    au: {
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onWindowState: (cb: (v: boolean) => void) => void;
      collect: () => Promise<CollectResult>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
