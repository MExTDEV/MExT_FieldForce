import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUserContext } from "@/lib/server/authenticated-user";
import {
  createSalesDocument,
  listSalesDocumentsForAppointment,
  type SalesCommercialDocumentType,
  type SalesDocumentLineInput,
  type SalesDocumentPaymentInput,
  type SalesDocumentSignatureInput,
} from "@/lib/server/salesday-commercial-documents";
import { assertSalesDayFeatureEnabled, getSalesDayRuntimeConfiguration } from "@/lib/server/salesday-feature-flags";
import { rethrowSalesDaySyncError } from "@/lib/server/salesday-sync-api";
import type { Language } from "@/lib/types";

type Body = {
  actorId?: string;
  deviceId?: string;
  documentType?: SalesCommercialDocumentType;
  onsiteInvoiceAllowed?: boolean;
  overrideReasonId?: string;
  overrideComment?: string;
  language?: Language;
  currency?: string;
  payment?: SalesDocumentPaymentInput;
  lines?: SalesDocumentLineInput[];
  signature?: SalesDocumentSignatureInput;
};

export async function GET(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApi("api/salesday/appointments/:appointmentId/documents:get", async () => {
    const { appointmentId } = await context.params;
    const query = new URL(request.url).searchParams;
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(query.get("actorId"));
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      const runtime = await getSalesDayRuntimeConfiguration();
      return { documents: await listSalesDocumentsForAppointment({ actor, loginSessionId, deviceId: query.get("deviceId") ?? "", provider: runtime.provider, appointmentId }) };
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  });
}

export async function POST(request: Request, context: { params: Promise<{ appointmentId: string }> }) {
  return handleApiCreated("api/salesday/appointments/:appointmentId/documents", async () => {
    const { appointmentId } = await context.params;
    const body = await request.json() as Body;
    if (!Array.isArray(body.lines)) badRequest("Minstens een documentlijn is verplicht.");
    if (!body.signature) badRequest("Handtekening of niet-ondertekenen-reden ontbreekt.");
    const { actor, loginSessionId } = await requireAuthenticatedUserContext(body.actorId);
    try {
      await assertSalesDayFeatureEnabled(actor, "SALESDAY");
      await assertSalesDayFeatureEnabled(actor, "ERP_WRITES");
      const runtime = await getSalesDayRuntimeConfiguration();
      return createSalesDocument({
        actor,
        loginSessionId,
        deviceId: body.deviceId ?? "",
        provider: runtime.provider,
        appointmentId,
        documentType: body.documentType,
        onsiteInvoiceAllowed: body.onsiteInvoiceAllowed,
        overrideReasonId: body.overrideReasonId,
        overrideComment: body.overrideComment,
        language: body.language,
        currency: body.currency,
        payment: body.payment,
        lines: body.lines,
        signature: body.signature,
      });
    } catch (error) {
      rethrowSalesDaySyncError(error);
    }
  }, "Het salesdocument kon niet worden aangemaakt.");
}
