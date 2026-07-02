import {
  createManagedUserInDatabase,
  listManagedUsers,
} from "@/lib/server/users";
import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { writeAuditLog } from "@/lib/server/audit";
import type { ManagedUser } from "@/lib/types";
import { requireAuthenticatedRead, requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { isOwnProfile, visibleManagedUsers } from "@/lib/user-management";

export async function GET() {
  return handleApi("api/users:get", async () => {
    const actor = await requireAuthenticatedRead();
    const users = await listManagedUsers();
    if (!actor) return { users };
    const visible = visibleManagedUsers(actor, users);
    const ownProfile = users.find((user) => isOwnProfile(actor, user));
    return {
      users: ownProfile && !visible.some((user) => user.id === ownProfile.id)
        ? [ownProfile, ...visible]
        : visible,
    };
  }, "Gebruikers konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApiCreated("api/users:post", async () => {
    const body = (await request.json()) as {
      actorId?: string;
      user?: ManagedUser;
      newTeamName?: string;
    };
    if (!body.actorId || !body.user) {
      badRequest("Ongeldige gebruikersgegevens.");
    }
    const actorId = (await requireAuthenticatedUser(body.actorId)).id;
    const userInput = body.user;
    let user: ManagedUser;
    try {
      user = await createManagedUserInDatabase(
        actorId,
        userInput,
        body.newTeamName
      );
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
      action: "user.create",
      newValue: { email: user.email, role: user.role, active: user.active },
    });
    return { user };
  }, "Gebruiker kon niet worden opgeslagen.");
}
