import { updateManagedUserInDatabase } from "@/lib/server/users";
import { badRequest, handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { ManagedUser } from "@/lib/types";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/users/:id:patch", async () => {
    const { id } = await params;
    const body = (await request.json()) as {
      actorId?: string;
      user?: ManagedUser;
    };
    if (!body.actorId || !body.user) {
      badRequest("Ongeldige gebruikersgegevens.");
    }
    const actorId = (await requireAuthenticatedUser(body.actorId)).id;
    const userInput = body.user;
    const user = await updateManagedUserInDatabase(actorId, id, userInput);
    await writeAuditLog({
      actorId,
      entityType: "User",
      entityId: user.id,
      action: "user.update",
      newValue: { email: user.email, role: user.role, active: user.active },
    });
    return { user };
  }, "Gebruiker kon niet worden opgeslagen.");
}
