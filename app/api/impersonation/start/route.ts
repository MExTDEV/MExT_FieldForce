import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedRealUserContext } from "@/lib/server/authenticated-user";
import { assertSameOrigin, requestMetadata, startImpersonation } from "@/lib/server/impersonation";

export async function POST(request: Request) {
  return handleApi("api/impersonation/start:post", async () => {
    assertSameOrigin(request);
    const body = await request.json() as { targetUserId?: string; reasonType?: string; reasonText?: string };
    if (!body.targetUserId || !body.reasonType) badRequest("Doelgebruiker en reden zijn verplicht.");
    const identity = await requireAuthenticatedRealUserContext();
    return startImpersonation({ actor: identity.realActor, loginSessionDatabaseId: identity.loginSessionDatabaseId, targetUserId: body.targetUserId, reasonType: body.reasonType, reasonText: body.reasonText, ...requestMetadata(request) });
  }, "Impersonating kon niet worden gestart.");
}
