"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession as useAuthSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  managedUserToMockUser,
  normalizeManagedUser,
} from "@/lib/user-management";
import type { Language, ManagedUser, MockUser } from "@/lib/types";

type SessionContextValue = {
  user: MockUser;
  users: MockUser[];
  managedUsers: ManagedUser[];
  language: Language;
  loading: boolean;
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
  retry: () => void;
  setUserId: (id: string) => void;
  setLanguage: (language: Language) => void;
  createManagedUser: (draft: ManagedUser) => Promise<ManagedUser>;
  updateManagedUser: (id: string, draft: ManagedUser) => Promise<ManagedUser>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const selectedUserStorageKey = "mext:selected-user-id";
const authenticatedMode = process.env.NEXT_PUBLIC_AUTH_MODE !== "demo";
const demoUserSwitcherEnabled =
  !authenticatedMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_USER_SWITCHER !== "false";
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

  useEffect(() => {
    if (!authenticatedMode || authStatus !== "loading") {
      setAuthTimedOut(false);
      return;
    }
    const timeout = window.setTimeout(() => setAuthTimedOut(true), 12_000);
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
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 12_000);
        const meResponse = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        }).finally(() => window.clearTimeout(timeout));
        const mePayload = (await meResponse.json()) as {
          user?: ManagedUser;
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
        let loadedUsers: ManagedUser[] = [];
        try {
          const usersController = new AbortController();
          const usersTimeout = window.setTimeout(() => usersController.abort(), 8_000);
          const usersResponse = await fetch("/api/users", {
            cache: "no-store",
            signal: usersController.signal,
          }).finally(() => window.clearTimeout(usersTimeout));
          const usersPayload = (await usersResponse.json()) as {
            users?: ManagedUser[];
          };
          if (usersResponse.ok) {
            loadedUsers = (usersPayload.users ?? []).map(normalizeManagedUser);
          }
        } catch (usersError) {
          console.warn("[session] De bredere gebruikerslijst is tijdelijk niet beschikbaar.", usersError);
        }
        const nextUsers = loadedUsers.some((profile) => profile.id === currentProfile.id)
          ? loadedUsers
          : [currentProfile, ...loadedUsers];
        if (cancelled) return;
        setManagedUsers(nextUsers);
        const authenticatedUserId =
          authSession?.user?.databaseUserId ?? currentProfile.id;
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
        console.error("[session]", loadError);
        if (!cancelled) {
          setError(
            loadError instanceof DOMException && loadError.name === "AbortError"
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

  async function createManagedUser(draft: ManagedUser) {
    const response = await fetch("/api/users", {
      method: "POST",
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

  const value = {
    user,
    users,
    managedUsers,
    language,
    loading,
    status,
    error,
    retry: () => {
      setError(null);
      setAuthTimedOut(false);
      setLoading(true);
      setRetryKey((value) => value + 1);
    },
    setUserId: switchUser,
    setLanguage,
    createManagedUser,
    updateManagedUser,
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
