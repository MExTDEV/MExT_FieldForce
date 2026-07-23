"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession as useAuthSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  managedUserToMockUser,
  normalizeManagedUser,
} from "@/lib/user-management";
import type { ImpersonationStatus, Language, ManagedUser, MockUser } from "@/lib/types";

type SessionContextValue = {
  user: MockUser;
  users: MockUser[];
  managedUsers: ManagedUser[];
  language: Language;
  loading: boolean;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
  impersonation: ImpersonationStatus;
  retry: () => void;
  setUserId: (id: string) => void;
  setLanguage: (language: Language) => void;
  stopImpersonating: () => Promise<void>;
  createManagedUser: (draft: ManagedUser, newTeamName?: string) => Promise<ManagedUser>;
  updateManagedUser: (id: string, draft: ManagedUser) => Promise<ManagedUser>;
  deleteManagedUser: (id: string, confirmation: string) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const selectedUserStorageKey = "mext:selected-user-id";
const authenticatedMode = process.env.NEXT_PUBLIC_AUTH_MODE !== "demo";
const demoUserSwitcherEnabled =
  !authenticatedMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_USER_SWITCHER !== "false";
const sessionTimeoutMs = process.env.NODE_ENV === "development" ? 30_000 : 20_000;
const usersTimeoutMs = process.env.NODE_ENV === "development" ? 25_000 : 15_000;
const unavailableUser: MockUser = {
  id: "",
  name: "Geen actieve gebruiker",
  email: "",
  role: "REPRESENTATIVE",
  country: "BE",
  language: "nl",
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useAuthSession();
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userId, setUserId] = useState("");
  const [language, setLanguage] = useState<Language>("nl");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationStatus>({ active: false });

  useEffect(() => {
    if (!authenticatedMode || authStatus !== "loading") {
      setAuthTimedOut(false);
      return;
    }
    const timeout = window.setTimeout(() => setAuthTimedOut(true), sessionTimeoutMs);
    return () => window.clearTimeout(timeout);
  }, [authStatus, retryKey]);

  useEffect(() => {
    if (
      authenticatedMode &&
      authStatus === "unauthenticated" &&
      pathname !== "/login"
    ) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [authStatus, pathname, router]);

  useEffect(() => {
    if (!authenticatedMode || authStatus !== "authenticated") return;
    const reportActivity = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/auth/activity", { method: "POST", cache: "no-store" }).catch((cause) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[session] Sessieactiviteit kon niet worden gemeld.", cause);
        }
      });
    };
    reportActivity();
    const interval = window.setInterval(reportActivity, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", reportActivity);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", reportActivity);
    };
  }, [authStatus]);

  useEffect(() => {
    if (authTimedOut) {
      setLoading(false);
      setError("De sessiecontrole duurde te lang. Controleer de verbinding en probeer opnieuw.");
    }
  }, [authTimedOut]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      if (authenticatedMode && authStatus === "loading") {
        setLoading(true);
        return;
      }
      if (authenticatedMode && authStatus === "unauthenticated") {
        setManagedUsers([]);
        setUserId("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const meResponse = await fetchWithTimeout(
          "/api/auth/me",
          { cache: "no-store" },
          sessionTimeoutMs
        );
        const mePayload = (await meResponse.json()) as {
          user?: ManagedUser;
          impersonation?: ImpersonationStatus;
          error?: string;
        };
        if (meResponse.status === 401 || meResponse.status === 403) {
          router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!meResponse.ok || !mePayload.user) {
          throw new Error(mePayload.error ?? "De huidige gebruiker kon niet worden geladen.");
        }

        const currentProfile = normalizeManagedUser(mePayload.user);
        const authenticatedUserId = currentProfile.id;
        if (!cancelled) setImpersonation(mePayload.impersonation ?? { active: false });
        if (authenticatedMode) {
          if (cancelled) return;
          setManagedUsers([currentProfile]);
          setUserId(authenticatedUserId);
          setLanguage(currentProfile.language);
          setLoading(false);
          try {
            const usersResponse = await fetchWithTimeout(
              "/api/users",
              { cache: "no-store" },
              usersTimeoutMs
            );
            const usersPayload = (await usersResponse.json()) as {
              users?: ManagedUser[];
            };
            if (usersResponse.ok) {
              const loadedUsers = (usersPayload.users ?? []).map(normalizeManagedUser);
              const nextUsers = loadedUsers.some((profile) => profile.id === currentProfile.id)
                ? loadedUsers
                : [currentProfile, ...loadedUsers];
              if (!cancelled) setManagedUsers(nextUsers);
            }
          } catch (usersError) {
            if (!(usersError instanceof RequestTimeoutError)) {
              console.warn("[session] De bredere gebruikerslijst is tijdelijk niet beschikbaar.", usersError);
            }
          }
          return;
        }

        let loadedUsers: ManagedUser[] = [];
        try {
          const usersResponse = await fetchWithTimeout(
            "/api/users",
            { cache: "no-store" },
            usersTimeoutMs
          );
          const usersPayload = (await usersResponse.json()) as {
            users?: ManagedUser[];
          };
          if (usersResponse.ok) {
            loadedUsers = (usersPayload.users ?? []).map(normalizeManagedUser);
          }
        } catch (usersError) {
          if (!(usersError instanceof RequestTimeoutError)) {
            console.warn("[session] De bredere gebruikerslijst is tijdelijk niet beschikbaar.", usersError);
          }
        }
        const nextUsers = loadedUsers.some((profile) => profile.id === currentProfile.id)
          ? loadedUsers
          : [currentProfile, ...loadedUsers];
        if (cancelled) return;
        setManagedUsers(nextUsers);
        const stored = demoUserSwitcherEnabled ? readStoredUserId() : null;
        const selected = authenticatedMode
          ? authenticatedUserId
          : stored && nextUsers.some((profile) => profile.id === stored)
            ? stored
            : nextUsers[0]?.id;
        if (authenticatedMode && !selected) {
          throw new Error("De Entra-gebruiker is niet gekoppeld aan een actieve FieldForce-gebruiker.");
        }
        if (selected) {
          const profile = nextUsers.find((item) => item.id === selected);
          setUserId(selected);
          if (profile) setLanguage(profile.language);
        }
      } catch (loadError) {
        if (!(loadError instanceof RequestTimeoutError)) {
          console.error("[session]", loadError);
        }
        if (!cancelled) {
          setError(
            loadError instanceof RequestTimeoutError
              ? "De sessiecontrole duurde te lang. Probeer opnieuw."
              : "Gebruikers konden niet uit de database worden geladen."
          );
          setManagedUsers([]);
          setUserId("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [authSession?.user?.databaseUserId, authStatus, pathname, retryKey, router]);

  const users = useMemo(
    () => managedUsers.filter((profile) => profile.active).map(managedUserToMockUser),
    [managedUsers]
  );
  const user = users.find((item) => item.id === userId) ?? users[0] ?? unavailableUser;
  const status: SessionContextValue["status"] = loading
    ? "loading"
    : error
      ? "error"
      : authenticatedMode && authStatus === "unauthenticated"
        ? "unauthenticated"
        : user.id
          ? "authenticated"
          : "unauthenticated";

  function switchUser(id: string) {
    const nextUser = users.find((item) => item.id === id);
    if (!nextUser) return;
    setUserId(id);
    setLanguage(nextUser.language);
    if (demoUserSwitcherEnabled) {
      try {
        localStorage.setItem(selectedUserStorageKey, id);
      } catch {
        // The demo switcher remains usable when browser storage is unavailable.
      }
    }
  }

  function persistLocal(next: ManagedUser[]) {
    setManagedUsers(next);
  }

  async function stopImpersonating() {
    const response = await fetch("/api/impersonation/stop", { method: "POST" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Impersonating kon niet worden gestopt.");
    window.location.assign("/dashboard");
  }

  async function createManagedUser(draft: ManagedUser, newTeamName?: string) {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: user.id, user: draft, newTeamName }),
    });
    const payload = (await response.json()) as {
      user?: ManagedUser;
      error?: string;
    };
    if (!response.ok || !payload.user) {
      throw new Error(payload.error ?? "Gebruiker kon niet worden opgeslagen.");
    }
    const created = normalizeManagedUser(payload.user);
    persistLocal([...managedUsers, created]);
    return created;
  }

  async function updateManagedUser(id: string, draft: ManagedUser) {
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: user.id, user: draft }),
    });
    const payload = (await response.json()) as {
      user?: ManagedUser;
      error?: string;
    };
    if (!response.ok || !payload.user) {
      throw new Error(payload.error ?? "Gebruiker kon niet worden opgeslagen.");
    }
    const updated = normalizeManagedUser(payload.user);
    persistLocal(managedUsers.map((profile) => (profile.id === id ? updated : profile)));
    return updated;
  }

  async function deleteManagedUser(id: string, confirmation: string) {
    const response = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actorId: user.id, confirmation }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Gebruiker kon niet permanent worden verwijderd.");
    }
    persistLocal(managedUsers.filter((profile) => profile.id !== id));
  }

  const value = {
    user,
    users,
    managedUsers,
    language,
    loading,
    status,
    error,
    impersonation,
    retry: () => {
      setError(null);
      setAuthTimedOut(false);
      setLoading(true);
      setRetryKey((value) => value + 1);
    },
    setUserId: switchUser,
    setLanguage,
    stopImpersonating,
    createManagedUser,
    updateManagedUser,
    deleteManagedUser,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}

function readStoredUserId() {
  try {
    return localStorage.getItem(selectedUserStorageKey);
  } catch {
    return null;
  }
}

class RequestTimeoutError extends Error {
  constructor() {
    super("De aanvraag duurde te lang.");
    this.name = "RequestTimeoutError";
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new RequestTimeoutError()), timeoutMs);
  });
  try {
    return await Promise.race([fetch(input, init), timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}
