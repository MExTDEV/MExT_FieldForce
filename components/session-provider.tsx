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
  error: string | null;
  setUserId: (id: string) => void;
  setLanguage: (language: Language) => void;
  createManagedUser: (draft: ManagedUser) => Promise<ManagedUser>;
  updateManagedUser: (id: string, draft: ManagedUser) => Promise<ManagedUser>;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const selectedUserStorageKey = "mext:selected-user-id";
const entraAuthMode = process.env.NEXT_PUBLIC_AUTH_MODE === "entra";
const demoUserSwitcherEnabled =
  !entraAuthMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_USER_SWITCHER !== "false";
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

  useEffect(() => {
    if (
      entraAuthMode &&
      authStatus === "unauthenticated" &&
      pathname !== "/login"
    ) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [authStatus, pathname, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      if (entraAuthMode && authStatus === "loading") return;
      if (entraAuthMode && authStatus === "unauthenticated") {
        setManagedUsers([]);
        setUserId("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/users", { cache: "no-store" });
        const payload = (await response.json()) as {
          users?: ManagedUser[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Gebruikers konden niet worden geladen.");
        }
        const nextUsers = (payload.users ?? []).map(normalizeManagedUser);
        if (!nextUsers.length) {
          throw new Error("Er zijn geen actieve gebruikers in de database.");
        }
        if (cancelled) return;
        setManagedUsers(nextUsers);
        const authenticatedUserId = authSession?.user?.databaseUserId;
        const stored = demoUserSwitcherEnabled ? localStorage.getItem(selectedUserStorageKey) : null;
        const selected = entraAuthMode
          ? authenticatedUserId
          : stored && nextUsers.some((profile) => profile.id === stored)
            ? stored
            : nextUsers[0]?.id;
        if (entraAuthMode && !selected) {
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
          setError("Gebruikers konden niet uit de database worden geladen.");
          setManagedUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [authSession?.user?.databaseUserId, authStatus]);

  const users = useMemo(
    () => managedUsers.filter((profile) => profile.active).map(managedUserToMockUser),
    [managedUsers]
  );
  const user = users.find((item) => item.id === userId) ?? users[0] ?? unavailableUser;

  function switchUser(id: string) {
    const nextUser = users.find((item) => item.id === id);
    if (!nextUser) return;
    setUserId(id);
    setLanguage(nextUser.language);
    if (demoUserSwitcherEnabled) {
      localStorage.setItem(selectedUserStorageKey, id);
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
    error,
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
