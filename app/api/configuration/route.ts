import { handleApi } from "@/lib/server/api";
import { getFieldForceConfiguration } from "@/lib/server/configuration";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";

export async function GET() {
  return handleApi(
    "api/configuration:get",
    async () => {
      await requireAuthenticatedRead();
      return getFieldForceConfiguration();
    },
    "Configuratie kon niet worden geladen."
  );
}
