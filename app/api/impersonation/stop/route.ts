import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedRealUserContext } from "@/lib/server/authenticated-user";
import { assertSameOrigin, requestMetadata, stopImpersonation } from "@/lib/server/impersonation";

export async function POST(request: Request) {
  return handleApi("api/impersonation/stop:post", async () => {
    assertSameOrigin(request);
    const identity = await requireAuthenticatedRealUserContext();
    return { stopped: await stopImpersonation(identity.loginSessionDatabaseId, identity.realActor.id, requestMetadata(request)) };
  }, "Impersonating kon niet worden gestopt.");
}
