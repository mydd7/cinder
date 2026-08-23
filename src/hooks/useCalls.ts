import { useCallback, useEffect, useState } from "react";
import type { CallsResult } from "@/lib/types";

const EMPTY: CallsResult = { sources: {}, installed: { skills: [], mcp: {} }, scannedAt: "" };

export function useCalls() {
  const [data, setData] = useState<CallsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const api = window.cinder;
    if (!api) {
      setData({ ...EMPTY, error: "Bridge unavailable" });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await api.calls());
    } catch (err) {
      setData({ ...EMPTY, error: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}
