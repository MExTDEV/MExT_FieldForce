import { updateManagedUserInDatabase } from "@/lib/server/users";
import { permanentlyDeleteUser } from "@/lib/server/permanent-delete";
import { badRequest, handleApi } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { ManagedUser } from "@/lib/types";
import { requireAuthenticatedUser, requireRole } from "@/lib/server/authenticated-user";

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
    let user: ManagedUser;
    try {
      user = await updateManagedUserInDatabase(actorId, id, userInput);
    } catch (error) {
      badRequest(
        error instanceof Error
          ? error.message
          : "Gebruiker kon niet worden opgeslagen."
      );
    }
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/users/:id:delete", async () => {
    const { id } = await params;
    const body = await request.json() as { actorId?: string; confirmation?: string };
    const actor = await requireAuthenticatedUser(body.actorId);
    requireRole(actor, ["SUPER_ADMIN"]);
    let result;
    try {
      result = await permanentlyDeleteUser(actor.id, id, body.confirmation ?? "");
    } catch (error) {
      badRequest(error instanceof Error ? error.message : "Gebruiker kon niet permanent worden verwijderd.");
    }
    await writeAuditLog({
      actorId: actor.id,
      entityType: "User",
      entityId: id,
      action: "user.permanentDelete",
      newValue: result,
    });
    return { ok: true, result };
  }, "Gebruiker kon niet permanent worden verwijderd.");
}
