"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  managedUserToMockUser,
  normalizeManagedUser,
  prepareManagedUserSave,
  seedManagedUsers,
} from "@/lib/user-management";
import type { Language, ManagedUser, MockUser } from "@/lib/types";

type SessionContextValue = {
  user: MockUser;
  users: MockUser[];
  managedUsers: ManagedUser[];
  language: Language;
  setUserId: (id: string) => void;
  setLanguage: (language: Language) => void;
  createManagedUser: (draft: ManagedUser) => ManagedUser;
  updateManagedUser: (id: string, draft: ManagedUser) => ManagedUser;
};

const SessionContext = createContext<SessionContextValue | null>(null);
const userStorageKey = "mext:managed-users:v1";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(seedManagedUsers);
  const [userId, setUserId] = useState(() => seedManagedUsers()[0].id);
  const [language, setLanguage] = useState<Language>(() => seedManagedUsers()[0].language);

  useEffect(() => {
    const storedUsers = localStorage.getItem(userStorageKey);
    let availableUsers = managedUsers;
    if (storedUsers) {
      try {
        const parsed = JSON.parse(storedUsers) as ManagedUser[];
        if (Array.isArray(parsed) && parsed.length) {
          availableUsers = parsed.map(normalizeManagedUser);
          setManagedUsers(availableUsers);
        }
      } catch {
        localStorage.removeItem(userStorageKey);
      }
    }
    const stored = localStorage.getItem("mext:mock-user");
    if (stored && availableUsers.some((profile) => profile.id === stored)) {
      const profile = availableUsers.find((item) => item.id === stored);
      setUserId(stored);
      if (profile) setLanguage(profile.language);
    }
    // The seed list is stable and only used during first hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const users = useMemo(
    () => managedUsers.filter((profile) => profile.active).map(managedUserToMockUser),
    [managedUsers]
  );
  const user = users.find((item) => item.id === userId) ?? users[0] ?? managedUserToMockUser(managedUsers[0]);

  function switchUser(id: string) {
    const nextUser = users.find((item) => item.id === id);
    if (!nextUser) return;
    setUserId(id);
    setLanguage(nextUser.language);
    localStorage.setItem("mext:mock-user", id);
  }

  function persist(next: ManagedUser[]) {
    setManagedUsers(next);
    localStorage.setItem(userStorageKey, JSON.stringify(next));
  }

  function createManagedUser(draft: ManagedUser) {
    const created = prepareManagedUserSave(user, managedUsers, draft);
    persist([...managedUsers, created]);
    return created;
  }

  function updateManagedUser(id: string, draft: ManagedUser) {
    const existing = managedUsers.find((profile) => profile.id === id);
    if (!existing) throw new Error("Gebruiker niet gevonden.");
    const updated = prepareManagedUserSave(user, managedUsers, draft, existing);
    persist(managedUsers.map((profile) => (profile.id === id ? updated : profile)));
    return updated;
  }

  const value = {
    user,
    users,
    managedUsers,
    language,
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
