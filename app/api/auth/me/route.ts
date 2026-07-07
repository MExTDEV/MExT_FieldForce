import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { normalizeManagedUser, roleTemplates } from "@/lib/user-management";

export async function GET() {
  return handleApi("api/auth/me:get", async () => {
    const actor = await requireAuthenticatedUser();
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
      teamSupervisor: actor.role === "SALES_LEADER",
      branchNumber: "",
      active: true,
      avatarUrl: "",
      permissions: { ...roleTemplates[actor.role].permissions },
      representativeId: actor.representativeId,
    });
    return { user };
  }, "De huidige gebruiker kon niet worden geladen.");
}
