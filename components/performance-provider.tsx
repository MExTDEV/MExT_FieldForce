"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/session-provider";
import {
  emptyPerformanceDataset,
  type PerformanceDataset,
} from "@/lib/performance-data";

type PerformanceContextValue = {
  dataset: PerformanceDataset;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const [dataset, setDataset] = useState<PerformanceDataset>(emptyPerformanceDataset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/performance?actorId=${encodeURIComponent(user.id)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        dataset?: PerformanceDataset;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Performancegegevens konden niet worden geladen.");
      }
      setDataset(payload.dataset ?? emptyPerformanceDataset);
    } catch (loadError) {
      console.error("[performance]", loadError);
      setError("Performancegegevens konden niet uit de database worden geladen.");
      setDataset(emptyPerformanceDataset);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setLoading(sessionLoading);
      setError(null);
      setDataset(emptyPerformanceDataset);
      return;
    }
    let active = true;
    async function loadIfActive() {
      await loadPerformance();
      if (!active) return;
    }
    loadIfActive();
    return () => {
      active = false;
    };
  }, [loadPerformance, sessionLoading, user.id]);

  const value = useMemo(
    () => ({
      dataset,
      loading,
      error,
      refresh: loadPerformance,
    }),
    [dataset, error, loadPerformance, loading]
  );

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error("usePerformance must be used within PerformanceProvider");
  }
  return context;
}
