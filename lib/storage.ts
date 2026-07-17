export const offlineStorageKeys = {
  draftIntervention: "mext:draft-intervention",
  pendingMutations: "mext:pending-mutations",
};

// Local storage is only for recoverable drafts and retry metadata, never as a business-data source.
export function saveLocalDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify({ value, savedAt: new Date().toISOString() }));
}

export function loadLocalDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    return (JSON.parse(stored) as { value: T }).value;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

// A future offline phase can move this layer to IndexedDB without changing the database source of truth.
