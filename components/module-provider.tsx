"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  appModuleRegistry,
  defaultAppModules,
  normalizeAppModules,
} from "@/lib/modules";
import type { AppModuleCode, AppModuleConfig } from "@/lib/types";

const LEGACY_STORAGE_KEYS = ["mext:app-modules:v2", "mext:app-modules:v1"];
const STORAGE_KEY = "mext:app-modules:v3";

type ModuleContextValue = {
  modules: AppModuleConfig[];
  enabledModules: AppModuleConfig[];
  isModuleEnabled: (code: AppModuleCode) => boolean;
  setModuleEnabled: (code: AppModuleCode, enabled: boolean) => void;
};

const ModuleContext = createContext<ModuleContextValue | null>(null);

function persist(modules: AppModuleConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
}

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const [modules, setModules] = useState<AppModuleConfig[]>(defaultAppModules);

  useEffect(() => {
    const storageKey = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].find((key) => localStorage.getItem(key));
    const stored = storageKey ? localStorage.getItem(storageKey) : null;
    if (!stored) {
      persist(defaultAppModules);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as AppModuleConfig[];
      const normalized = normalizeAppModules(Array.isArray(parsed) ? parsed : defaultAppModules);
      setModules(normalized);
      if (storageKey !== STORAGE_KEY) persist(normalized);
    } catch {
      if (storageKey) localStorage.removeItem(storageKey);
      persist(defaultAppModules);
    }
  }, []);

  const value = useMemo<ModuleContextValue>(() => ({
    modules,
    enabledModules: modules.filter((module) => module.enabled),
    isModuleEnabled: (code) =>
      modules.some((module) => module.code === code && module.enabled),
    setModuleEnabled: (code, enabled) => {
      const now = new Date().toISOString();
      setModules((current) => {
        const knownCodes = new Set(appModuleRegistry.map((module) => module.code));
        if (!knownCodes.has(code)) return current;
        const next = current.map((module) =>
          module.code === code ? { ...module, enabled, updatedAt: now } : module
        );
        persist(next);
        return next;
      });
    },
  }), [modules]);

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModules() {
  const context = useContext(ModuleContext);
  if (!context) throw new Error("useModules must be used within ModuleProvider");
  return context;
}
