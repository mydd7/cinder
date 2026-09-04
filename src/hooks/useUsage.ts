import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectResult, ScanProgress } from "@/lib/types";

const EMPTY: CollectResult = { entries: [], sources: [], home: "", scannedAt: "" };
const NO_PROGRESS: ScanProgress = { done: 0, total: 0, label: "" };

export function useUsage() {
  const [data, setData] = useState<CollectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>(NO_PROGRESS);

  useEffect(() => {
    return window.cinder?.onScanProgress(setProgress);
  }, []);

  const reload = useCallback(async () => {
    const api = window.cinder;
    if (!api) {
      setData({ ...EMPTY, error: "Bridge unavailable" });
      setLoading(false);
      return true;
    }
    setProgress(NO_PROGRESS);
    setLoading(true);
    try {
      const res = await api.collect();
      if (res.cancelled) return false;
      setData(res);
    } catch (err) {
      setData({ ...EMPTY, error: String(err) });
    } finally {
      setLoading(false);
    }
    return true;
  }, []);

  const cancel = useCallback(async () => {
    await window.cinder?.cancelScan().catch(() => false);
  }, []);

  const pending = useRef<Promise<CollectResult | null> | null>(null);

  const prefetch = useCallback(() => {
    const api = window.cinder;
    if (!api) return;
    if (!pending.current) pending.current = api.snapshotUsage().catch(() => null);
  }, []);

  const restore = useCallback(async () => {
    const api = window.cinder;
    if (!api) {
      setData({ ...EMPTY, error: "Bridge unavailable" });
      return false;
    }
    if (!pending.current) pending.current = api.snapshotUsage().catch(() => null);
    const cached = await pending.current;
    pending.current = null;
    if (!cached) return false;
    setData(cached);
    return true;
  }, []);

  return { data, loading, progress, reload, restore, prefetch, cancel };
}
