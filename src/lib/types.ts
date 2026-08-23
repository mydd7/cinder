export interface Entry {
  ts: string;
  t: number;
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

export interface CallStat {
  name: string;
  count: number;
}

export interface McpToolStat {
  server: string;
  name: string;
  count: number;
}

export interface SourceCalls {
  total: number;
  tools: CallStat[];
  mcpTools: McpToolStat[];
  mcpServers: CallStat[];
  skills: CallStat[];
  byDay: Record<string, number>;
}

export interface InstalledInfo {
  skills: string[];
  mcp: Record<string, string[]>;
}

export interface CallsResult {
  sources: Record<string, SourceCalls>;
  installed?: InstalledInfo;
  scannedAt: string;
  error?: string;
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
    cinder?: {
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<boolean>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onWindowState: (cb: (v: boolean) => void) => void;
      setBackground: (bg: string) => void;
      collect: () => Promise<CollectResult>;
      calls: () => Promise<CallsResult>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
