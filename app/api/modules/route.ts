import { listAppModules } from "@/lib/server/modules";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";

export async function GET() {
  return handleApi("api/modules:get", async () => {
    await requireAuthenticatedRead();
    return { modules: await listAppModules() };
  }, "Modules konden niet worden geladen.");
}
