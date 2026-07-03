import { auth } from "@/auth";
import { handleApi, unauthorized } from "@/lib/server/api";
import { touchLoginSession } from "@/lib/server/login-history";

export async function POST() {
  return handleApi("api/auth/activity:post", async () => {
    const session = await auth();
    const sessionId = session?.user?.loginSessionId;
    if (!sessionId) unauthorized("Geen actieve login-sessie gevonden.");
    return { updated: await touchLoginSession(sessionId) };
  }, "Sessieactiviteit kon niet worden bijgewerkt.");
}
