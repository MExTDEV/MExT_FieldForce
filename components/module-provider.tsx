"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/session-provider";
import {
  appModuleRegistry,
  defaultAppModules,
  normalizeAppModules,
} from "@/lib/modules";
import type { AppModuleCode, AppModuleConfig } from "@/lib/types";

type ModuleContextValue = {
  modules: AppModuleConfig[];
  enabledModules: AppModuleConfig[];
  error: string | null;
  loading: boolean;
  isModuleEnabled: (code: AppModuleCode) => boolean;
  setModuleEnabled: (code: AppModuleCode, enabled: boolean) => Promise<void>;
};

const ModuleContext = createContext<ModuleContextValue | null>(null);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const [modules, setModules] = useState<AppModuleConfig[]>(defaultAppModules);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setLoading(sessionLoading);
      setError(null);
      setModules(defaultAppModules);
      return;
    }
    let cancelled = false;
    async function loadModules() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/modules", { cache: "no-store" });
        const payload = (await response.json()) as {
          modules?: AppModuleConfig[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Modules konden niet worden geladen.");
        }
        if (!cancelled) {
          setModules(normalizeAppModules(payload.modules ?? defaultAppModules));
        }
      } catch (loadError) {
        console.error("[modules]", loadError);
        if (!cancelled) {
          setError("Modules konden niet uit de database worden geladen.");
          setModules(defaultAppModules);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadModules();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, user.id]);

  const value = useMemo<ModuleContextValue>(() => ({
    modules,
    enabledModules: modules.filter((module) => module.enabled),
    error,
    loading,
    isModuleEnabled: (code) =>
      modules.some((module) => module.code === code && module.enabled),
    setModuleEnabled: async (code, enabled) => {
      const now = new Date().toISOString();
      const knownCodes = new Set(appModuleRegistry.map((module) => module.code));
      if (!knownCodes.has(code)) return;
      const previous = modules;
      setError(null);
      setModules((current) =>
        current.map((module) =>
          module.code === code ? { ...module, enabled, updatedAt: now } : module
        )
      );
      try {
        const response = await fetch(`/api/modules/${code}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorId: user.id, enabled }),
        });
        const payload = (await response.json()) as {
          module?: AppModuleConfig;
          error?: string;
        };
        if (!response.ok || !payload.module) {
          throw new Error(payload.error ?? "Module kon niet worden opgeslagen.");
        }
        setModules((current) =>
          normalizeAppModules(
            current.map((module) =>
              module.code === code ? payload.module! : module
            )
          )
        );
      } catch (saveError) {
        console.error("[modules]", saveError);
        setModules(previous);
        setError("Modulewijziging kon niet worden opgeslagen.");
      }
    },
  }), [error, loading, modules, user.id]);

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (!context) throw new Error("useModules must be used within ModuleProvider");
  return context;
}
