import { badRequest, forbidden, handleApi, notFound } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listUserLoginSessions } from "@/lib/server/login-history";
import { listManagedUsers } from "@/lib/server/users";
import { isOwnProfile, userManagementCapabilities } from "@/lib/user-management";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/users/:id/login-sessions:get", async () => {
    const { id } = await params;
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    const users = await listManagedUsers();
    const target = users.find((profile) => profile.id === id);
    if (!target) notFound("Gebruiker niet gevonden.");
    if (
      !isOwnProfile(actor, target) &&
      !userManagementCapabilities(actor, target).canView
    ) {
      forbidden("Je hebt geen toegang tot de loginhistoriek van deze gebruiker.");
    }

    const from = validDateFilter(url.searchParams.get("from"));
    const to = validDateFilter(url.searchParams.get("to"));
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const page = Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

    return listUserLoginSessions({ userId: target.id, from, to, page });
  }, "Login-sessies konden niet worden geladen.");
}

function validDateFilter(value: string | null) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest("Ongeldige datumfilter.");
  }
  return value;
}
