export const offlineStorageKeys = {
  draftIntervention: "mext:draft-intervention",
  pendingMutations: "mext:pending-mutations",
};

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

// TODO: replace this local draft layer with IndexedDB and a retryable sync queue.
