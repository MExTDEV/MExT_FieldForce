import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import { stageSalesDayAttachment, listSalesDayAttachments } from "@/lib/server/salesday-attachments";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";

export async function GET(request: Request, context: { params: Promise<{ relationId: string }> }) {
  return handleApi("api/salesday/customers/:relationId/attachments:get", async () => {
    const { relationId } = await context.params; const query = new URL(request.url).searchParams; const appointmentId = query.get("appointmentId");
    if (!appointmentId) badRequest("Een afspraak van vandaag is vereist.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(query.get("actorId"));
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); const runtime = await getSalesDayRuntimeConfiguration(); return { attachments: await listSalesDayAttachments({ actor, loginSessionId, deviceId: query.get("deviceId") ?? "", provider: runtime.provider, relationId, appointmentId }) }; } catch (error) { rethrowSalesDaySyncError(error); }
  });
}

export async function POST(request: Request, context: { params: Promise<{ relationId: string }> }) {
  return handleApiCreated("api/salesday/customers/:relationId/attachments", async () => {
    const { relationId } = await context.params; const formData = await request.formData(); const file = formData.get("file");
    if (!(file instanceof File)) badRequest("Selecteer een bestand om te uploaden.");
    const actorId = formData.get("actorId"); const deviceId = formData.get("deviceId"); const appointmentId = formData.get("appointmentId"); const categoryExternalId = formData.get("categoryExternalId");
    if (typeof appointmentId !== "string" || !appointmentId.trim()) badRequest("Een afspraak van vandaag is vereist.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(typeof actorId === "string" ? actorId : undefined);
    try { await assertSalesDayFeatureEnabled(actor, "SALESDAY"); await assertSalesDayFeatureEnabled(actor, "ERP_WRITES"); const runtime = await getSalesDayRuntimeConfiguration(); return stageSalesDayAttachment({ actor, loginSessionId, deviceId: typeof deviceId === "string" ? deviceId : "", provider: runtime.provider, targetType: "CUSTOMER", appointmentId, relationId, categoryExternalId: typeof categoryExternalId === "string" ? categoryExternalId : "", fileName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) }); } catch (error) { rethrowSalesDaySyncError(error); }
  }, "De klantbijlage kon niet worden klaargezet.");
}
