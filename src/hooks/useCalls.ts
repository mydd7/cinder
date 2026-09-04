import { useCallback, useState } from "react";
import type { CallsResult } from "@/lib/types";

const EMPTY: CallsResult = { sources: {}, installed: { skills: [], mcp: {} }, scannedAt: "" };

export function useCalls() {
  const [data, setData] = useState<CallsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    const api = window.cinder;
    if (!api) {
      setData({ ...EMPTY, error: "Bridge unavailable" });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.calls();
      setData(res.cancelled ? { ...EMPTY, cancelled: true } : res);
    } catch (err) {
      setData({ ...EMPTY, error: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  const restore = useCallback(async () => {
    const api = window.cinder;
    if (!api) return false;
    try {
      const cached = await api.snapshotCalls();
      if (!cached) return false;
      setData(cached);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { data, loading, reload, restore };
}
