"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { FieldForceConfiguration } from "@/lib/types";

const emptyConfiguration: FieldForceConfiguration = {
  coachingFramework: [],
  kpiDefinitions: [],
};

type ConfigurationContextValue = FieldForceConfiguration & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ConfigurationContext = createContext<ConfigurationContextValue | null>(null);

export function ConfigurationProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const [configuration, setConfiguration] = useState(emptyConfiguration);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadConfiguration() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/configuration", { cache: "no-store" });
      const payload = (await response.json()) as Partial<FieldForceConfiguration> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Configuratie kon niet worden geladen.");
      }
      setConfiguration({
        coachingFramework: payload.coachingFramework ?? [],
        kpiDefinitions: payload.kpiDefinitions ?? [],
      });
    } catch (loadError) {
      console.error("[configuration]", loadError);
      setConfiguration(emptyConfiguration);
      setError("Kapstok en KPI-definities konden niet uit de database worden geladen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setLoading(sessionLoading);
      setError(null);
      setConfiguration(emptyConfiguration);
      return;
    }
    void loadConfiguration();
  }, [sessionLoading, user.id]);

  const value = useMemo(
    () => ({
      ...configuration,
      loading,
      error,
      refresh: loadConfiguration,
    }),
    [configuration, error, loading]
  );

  return (
    <ConfigurationContext.Provider value={value}>
      {children}
    </ConfigurationContext.Provider>
  );
}

export function useConfiguration() {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error("useConfiguration must be used within ConfigurationProvider");
  }
  return context;
}
