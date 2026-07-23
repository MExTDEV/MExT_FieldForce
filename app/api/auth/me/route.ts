import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { getImpersonationStatus } from "@/lib/server/impersonation";
import { listManagedUsers } from "@/lib/server/users";
import { normalizeManagedUser, roleTemplates } from "@/lib/user-management";

export async function GET() {
  return handleApi("api/auth/me:get", async () => {
    const context = await requireAuthenticatedUserContext();
    const actor = context.actor;
    const impersonation = context.loginSessionDatabaseId
      ? await getImpersonationStatus(context.loginSessionDatabaseId)
      : { active: false } as const;
    const managedUser = (await listManagedUsers()).find((user) => user.id === actor.id);
    if (managedUser) return { user: managedUser, impersonation };
    const [firstName, ...lastNameParts] = actor.name.split(" ");
    const user = normalizeManagedUser({
      id: actor.id,
      firstName: firstName || actor.name || actor.email,
      lastName: lastNameParts.join(" "),
      email: actor.email,
      mobile: "",
      language: actor.language,
      country: actor.country,
      countryAccess: actor.countryAccess ?? [],
      teamId: actor.teamId ?? "",
      teamName: "",
      role: actor.role,
      representativeLevel: "STARTER",
      teamSupervisor: actor.role === "SALES_LEADER",
      branchNumber: "",
      active: true,
      avatarUrl: "",
      permissions: { ...roleTemplates[actor.role].permissions, ...actor.permissions },
      representativeId: actor.representativeId,
    });
    return { user, impersonation };
  }, "De huidige gebruiker kon niet worden geladen.");
}
