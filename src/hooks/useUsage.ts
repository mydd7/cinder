import { useCallback, useEffect, useState } from "react";
import type { CollectResult } from "@/lib/types";

export function useUsage() {
  const [data, setData] = useState<CollectResult | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await window.au.collect();
      setData(res);
    } catch (err) {
      setData({ entries: [], sources: [], home: "", scannedAt: "", error: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, reload };
}
