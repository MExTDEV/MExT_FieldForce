"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/session-provider";
import {
  salesDayFeatureKeys,
  type SalesDayFeatureDecision,
  type SalesDayFeatureKey,
} from "@/lib/salesday/feature-flags";
import type { SalesDayNotificationType } from "@/lib/salesday/runtime-configuration";

type SalesDayFeatureContextValue = {
  access: Record<SalesDayFeatureKey, SalesDayFeatureDecision>;
  enabledNotifications: SalesDayNotificationType[];
  loading: boolean;
  error: string | null;
  isEnabled: (key: SalesDayFeatureKey) => boolean;
};

const disabledAccess = Object.fromEntries(
  salesDayFeatureKeys.map((key) => [key, {
    key,
    enabled: false,
    matchedScope: null,
    reason: "GLOBAL_DISABLED" as const,
  }]),
) as Record<SalesDayFeatureKey, SalesDayFeatureDecision>;

const SalesDayFeatureContext = createContext<SalesDayFeatureContextValue | null>(null);

export function SalesDayFeatureProvider({ children }: { children: React.ReactNode }) {
  const { loading: sessionLoading, user } = useSession();
  const [access, setAccess] = useState(disabledAccess);
  const [enabledNotifications, setEnabledNotifications] = useState<SalesDayNotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading || !user.id) {
      setAccess(disabledAccess);
      setEnabledNotifications([]);
      setLoading(sessionLoading);
      setError(null);
      return;
    }
    let cancelled = false;
    async function loadAccess() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/salesday/features?actorId=${encodeURIComponent(user.id)}`, {
          cache: "no-store",
        });
        const payload = await response.json() as {
          access?: Record<SalesDayFeatureKey, SalesDayFeatureDecision>;
          enabledNotifications?: SalesDayNotificationType[];
          error?: string;
        };
        if (!response.ok || !payload.access) {
          throw new Error(payload.error ?? "SalesDay-activatie kon niet worden geladen.");
        }
        if (!cancelled) {
          setAccess(payload.access);
          setEnabledNotifications(payload.enabledNotifications ?? []);
        }
      } catch (cause) {
        console.error("[salesday/features]", cause);
        if (!cancelled) {
          setAccess(disabledAccess);
          setEnabledNotifications([]);
          setError(cause instanceof Error ? cause.message : "SalesDay-activatie kon niet worden geladen.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAccess();
    return () => { cancelled = true; };
  }, [sessionLoading, user.id]);

  const value = useMemo<SalesDayFeatureContextValue>(() => ({
    access,
    enabledNotifications,
    loading,
    error,
    isEnabled: (key) => access[key].enabled,
  }), [access, enabledNotifications, error, loading]);

  return <SalesDayFeatureContext.Provider value={value}>{children}</SalesDayFeatureContext.Provider>;
}

export function useSalesDayFeatures() {
  const context = useContext(SalesDayFeatureContext);
  if (!context) throw new Error("useSalesDayFeatures must be used within SalesDayFeatureProvider");
  return context;
}
