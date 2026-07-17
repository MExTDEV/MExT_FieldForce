"use client";

import { signOut } from "next-auth/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useSalesDayFeatures } from "@/components/salesday/feature-provider";
import { useSession } from "@/components/session-provider";
import { executeDeviceControls, type LocalDeviceControlCommand } from "@/lib/device/device-control";
import { IndexedDbDeviceKeyVault, loadLocalDeviceKey, provisionLocalDeviceKey } from "@/lib/device/device-key-vault";
import { EncryptedDeviceStore } from "@/lib/device/encrypted-store";
import { IndexedDbDeviceStoreDriver } from "@/lib/device/indexeddb-driver";
import type { SalesErpProvider } from "@/lib/server/integrations/sales-erp/contracts";

const deviceIdentityStorageKey = "fieldforce:salesday-device-id";
const tokenRecordKey = "device-token";
const tokenPayloadVersion = 1;
const controlPollIntervalMs = 30_000;

type DeviceRegistrationDto = {
  deviceId: string;
  status: "ACTIVE" | "REVOKED";
  keyVersion: number;
  keyFingerprint: string | null;
};

type BootstrapDto = {
  schemaVersion: "salesday-bootstrap-v1";
  serverNow: string;
  deviceId: string;
  provider: SalesErpProvider;
};

type RuntimeState = {
  phase: "DISABLED" | "NOT_APPLICABLE" | "INITIALIZING" | "READY" | "REPLACEMENT_REQUIRED" | "ERROR";
  deviceId: string | null;
  provider: SalesErpProvider | null;
  bootstrap: BootstrapDto | null;
  encryptedStore: EncryptedDeviceStore | null;
  error: string | null;
};

const initialState: RuntimeState = {
  phase: "DISABLED",
  deviceId: null,
  provider: null,
  bootstrap: null,
  encryptedStore: null,
  error: null,
};

const SalesDayDeviceRuntimeContext = createContext<RuntimeState | null>(null);

export function SalesDayDeviceRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  const features = useSalesDayFeatures();
  const [state, setState] = useState<RuntimeState>(initialState);
  const initializationRef = useRef<{
    userId: string;
    promise: Promise<InitializedDeviceRuntime>;
  } | null>(null);

  useEffect(() => {
    if (sessionLoading || features.loading) return;
    if (!features.isEnabled("SALESDAY")) {
      initializationRef.current = null;
      setState(initialState);
      return;
    }
    if (user.role !== "REPRESENTATIVE") {
      initializationRef.current = null;
      setState({ ...initialState, phase: "NOT_APPLICABLE" });
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    if (initializationRef.current?.userId !== user.id) {
      initializationRef.current = {
        userId: user.id,
        promise: initializeDeviceRuntime(user.id),
      };
    }
    const initialization = initializationRef.current;

    async function initialize() {
      setState({ ...initialState, phase: "INITIALIZING" });
      try {
        const { localDeviceId, secured, bootstrap, keyVault, storeDriver } = await initialization.promise;
        if (cancelled) return;
        setState({
          phase: "READY",
          deviceId: localDeviceId,
          provider: bootstrap.provider,
          bootstrap,
          encryptedStore: secured.store,
          error: null,
        });

        const poll = () => void pollDeviceControls({
          deviceId: localDeviceId,
          deviceToken: secured.deviceToken,
          keyVault,
          storeDriver,
        }).catch((cause) => {
          if (!cancelled && process.env.NODE_ENV === "development") {
            console.warn("[salesday/device-controls]", cause);
          }
        });
        poll();
        pollTimer = setInterval(poll, controlPollIntervalMs);
      } catch (cause) {
        if (!cancelled) {
          if (initializationRef.current === initialization) initializationRef.current = null;
          setState({
            ...initialState,
            phase: cause instanceof DeviceReplacementRequiredError ? "REPLACEMENT_REQUIRED" : "ERROR",
            deviceId: cause instanceof DeviceReplacementRequiredError ? cause.deviceId : null,
            error: cause instanceof Error ? cause.message : "SalesDay-toestelbeveiliging kon niet worden gestart.",
          });
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [features, sessionLoading, user.id, user.role]);

  const value = useMemo(() => state, [state]);
  return <SalesDayDeviceRuntimeContext.Provider value={value}>{children}</SalesDayDeviceRuntimeContext.Provider>;
}

type InitializedDeviceRuntime = {
  localDeviceId: string;
  secured: Awaited<ReturnType<typeof ensureSecuredDevice>>;
  bootstrap: BootstrapDto;
  keyVault: IndexedDbDeviceKeyVault;
  storeDriver: IndexedDbDeviceStoreDriver;
};

class DeviceReplacementRequiredError extends Error {
  constructor(readonly deviceId: string) {
    super("Er is al een ander persoonlijk SalesDay-toestel gekoppeld. Laat dit toestel gecontroleerd vervangen.");
    this.name = "DeviceReplacementRequiredError";
  }
}

async function initializeDeviceRuntime(actorId: string): Promise<InitializedDeviceRuntime> {
  const localDeviceId = getOrCreateDeviceIdentity();
  let registration = await loadRegistration(actorId);
  if (!registration) registration = await registerDevice(actorId, localDeviceId);
  if (registration.deviceId !== localDeviceId) throw new DeviceReplacementRequiredError(localDeviceId);
  const keyVault = new IndexedDbDeviceKeyVault();
  const storeDriver = new IndexedDbDeviceStoreDriver();
  try {
    const secured = await ensureSecuredDevice({ actorId, registration, keyVault, storeDriver });
    const bootstrap = await requestJson<BootstrapDto>(
      `/api/salesday/bootstrap?actorId=${encodeURIComponent(actorId)}&deviceId=${encodeURIComponent(localDeviceId)}`,
    );
    return { localDeviceId, secured, bootstrap, keyVault, storeDriver };
  } catch (error) {
    await Promise.allSettled([keyVault.close(), storeDriver.close()]);
    throw error;
  }
}

export function useSalesDayDeviceRuntime() {
  const context = useContext(SalesDayDeviceRuntimeContext);
  if (!context) throw new Error("useSalesDayDeviceRuntime must be used within SalesDayDeviceRuntimeProvider");
  return context;
}

async function loadRegistration(actorId: string) {
  const response = await requestJson<{ registration: DeviceRegistrationDto | null }>(
    `/api/salesday/devices?actorId=${encodeURIComponent(actorId)}`,
  );
  return response.registration;
}

async function registerDevice(actorId: string, deviceId: string) {
  const response = await requestJson<{ registration: DeviceRegistrationDto }>("/api/salesday/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actorId,
      deviceId,
      platform: /Android/i.test(navigator.userAgent) ? "ANDROID" : "WINDOWS",
      deviceLabel: navigator.platform || null,
      operatingSystemVersion: navigator.userAgent.slice(0, 64),
    }),
  });
  return response.registration;
}

async function ensureSecuredDevice(input: {
  actorId: string;
  registration: DeviceRegistrationDto;
  keyVault: IndexedDbDeviceKeyVault;
  storeDriver: IndexedDbDeviceStoreDriver;
}) {
  if (input.registration.keyVersion > 0 && input.registration.keyFingerprint) {
    const local = await loadLocalDeviceKey({
      deviceId: input.registration.deviceId,
      expectedKeyVersion: input.registration.keyVersion,
      expectedFingerprint: input.registration.keyFingerprint,
      driver: input.keyVault,
    });
    if (local.status === "found") {
      const store = createSecurityStore(input.actorId, input.registration.deviceId, local.key, input.storeDriver);
      const token = await store.read<{ deviceToken: string }>(tokenRecordKey, { targetVersion: tokenPayloadVersion });
      if (token.status === "found" && token.value.deviceToken) {
        return { store, deviceToken: token.value.deviceToken };
      }
    }
  }

  const challenge = await requestJson<{
    challengeId: string;
    token: string;
    targetKeyVersion: number;
  }>(`/api/salesday/devices/${encodeURIComponent(input.registration.deviceId)}/key/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actorId: input.actorId }),
  });
  const local = await provisionLocalDeviceKey({
    deviceId: input.registration.deviceId,
    keyVersion: challenge.targetKeyVersion,
    driver: input.keyVault,
  });
  const confirmed = await requestJson<{ deviceToken: string }>(
    `/api/salesday/devices/${encodeURIComponent(input.registration.deviceId)}/key/confirm`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorId: input.actorId,
        challengeId: challenge.challengeId,
        token: challenge.token,
        keyFingerprint: local.fingerprint,
      }),
    },
  );
  const store = createSecurityStore(input.actorId, input.registration.deviceId, local.key, input.storeDriver);
  await store.write(tokenRecordKey, { deviceToken: confirmed.deviceToken }, tokenPayloadVersion);
  return { store, deviceToken: confirmed.deviceToken };
}

function createSecurityStore(
  userId: string,
  deviceId: string,
  key: CryptoKey,
  driver: IndexedDbDeviceStoreDriver,
) {
  return new EncryptedDeviceStore({
    namespace: "salesday-security",
    binding: { userId, deviceId },
    key,
    driver,
  });
}

async function pollDeviceControls(input: {
  deviceId: string;
  deviceToken: string;
  keyVault: IndexedDbDeviceKeyVault;
  storeDriver: IndexedDbDeviceStoreDriver;
}) {
  const headers = { "x-fieldforce-device-token": input.deviceToken };
  const response = await requestJson<{ commands: LocalDeviceControlCommand[] }>(
    `/api/salesday/devices/${encodeURIComponent(input.deviceId)}/commands`,
    { headers },
  );
  if (!response.commands.length) return;
  await executeDeviceControls({
    commands: response.commands,
    clearEncryptedDeviceData: () => input.storeDriver.clear(),
    clearDeviceKeys: () => input.keyVault.clear(),
    clearAdditionalLocalData: async () => localStorage.removeItem(deviceIdentityStorageKey),
    acknowledge: async (commandId) => {
      await requestJson(
        `/api/salesday/devices/${encodeURIComponent(input.deviceId)}/commands/${encodeURIComponent(commandId)}/ack`,
        { method: "POST", headers },
      );
    },
    logout: async () => {
      if (process.env.NEXT_PUBLIC_AUTH_MODE === "demo") window.location.assign("/login");
      else await signOut({ callbackUrl: "/login" });
    },
  });
}

function getOrCreateDeviceIdentity() {
  const current = localStorage.getItem(deviceIdentityStorageKey)?.trim();
  if (current) return current;
  const created = `fieldforce-${crypto.randomUUID()}`;
  localStorage.setItem(deviceIdentityStorageKey, created);
  return created;
}

async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `SalesDay-HTTP ${response.status}`);
  return body;
}
