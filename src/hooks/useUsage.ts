import { useCallback, useEffect, useState } from "react";
import type { CollectResult } from "@/lib/types";

const EMPTY: CollectResult = { entries: [], sources: [], home: "", scannedAt: "" };

export function useUsage() {
  const [data, setData] = useState<CollectResult | null>(null);
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
      setData(await api.collect());
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
