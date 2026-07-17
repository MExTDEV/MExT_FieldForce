import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { stageSalesDayAttachment, listSalesDayAttachments } from "@/lib/server/salesday-attachments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApi("api/salesday/appointments/:appointmentId/attachments:get", async () => {
    const { appointmentId } = await context.params; const query = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(query.get("actorId"));
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); const runtime = await getSalesDayRuntimeConfiguration(); return { attachments: await listSalesDayAttachments({ actor, loginSessionId, deviceId: query.get("deviceId") ?? "", provider: runtime.provider, appointmentId }) }; } catch (error) { rethrowSalesDaySyncError(error); }
  });
}

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApiCreated("api/salesday/appointments/:appointmentId/attachments", async () => {
    const { appointmentId } = await context.params; const formData = await request.formData(); const file = formData.get("file");
    if (!(file instanceof File)) badRequest("Selecteer een bestand om te uploaden.");
    const actorId = formData.get("actorId"); const deviceId = formData.get("deviceId"); const categoryExternalId = formData.get("categoryExternalId");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(typeof actorId === "string" ? actorId : undefined);
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES"); const runtime = await getSalesDayRuntimeConfiguration(); return stageSalesDayAttachment({ actor, loginSessionId, deviceId: typeof deviceId === "string" ? deviceId : "", provider: runtime.provider, targetType: "APPOINTMENT", appointmentId, categoryExternalId: typeof categoryExternalId === "string" ? categoryExternalId : "", fileName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) }); } catch (error) { rethrowSalesDaySyncError(error); }
  }, "De bijlage kon niet worden klaargezet.");
}
