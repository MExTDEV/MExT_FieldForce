import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listManagedUsers } from "@/lib/server/users";

export async function GET() {
  return handleApi("api/auth/me:get", async () => {
    const actor = await requireAuthenticatedUser();
    const users = await listManagedUsers();
    const user = users.find((item) => item.id === actor.id);
    if (!user) throw new Error("De aangemelde gebruiker bestaat niet meer.");
    return { user };
  }, "De huidige gebruiker kon niet worden geladen.");
}
