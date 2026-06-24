export type SafeDbResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function withDatabaseErrorBoundary<T>(
  action: () => Promise<T>,
  userMessage = "De gegevens konden niet worden geladen. Probeer het later opnieuw."
): Promise<SafeDbResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    console.error("[database]", error);
    return { ok: false, error: userMessage };
  }
}
