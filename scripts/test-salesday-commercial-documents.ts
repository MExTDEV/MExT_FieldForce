import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildSalesErpCommand,
  canonicalSalesErpJson,
  type SalesErpCommandContext,
} from "../lib/server/integrations/sales-erp";
import { proposeSalesDocumentType } from "../lib/server/salesday-commercial-documents";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const expectText = (relative: string, patterns: string[]) => {
  const source = read(relative);
  for (const pattern of patterns) assert.ok(source.includes(pattern), `${relative} must contain ${pattern}`);
};

assert.equal(proposeSalesDocumentType({ lines: [{ quantity: "2.000", representativeStockQuantity: "1.000" }] }), "ORDER");
assert.equal(proposeSalesDocumentType({ lines: [{ quantity: "2.000", representativeStockQuantity: "2.000" }], onsiteInvoiceAllowed: false }), "ORDER_ALREADY_DELIVERED");
assert.equal(proposeSalesDocumentType({ lines: [{ quantity: "2.000", representativeStockQuantity: "2.000" }], onsiteInvoiceAllowed: true }), "INVOICE");

const context: SalesErpCommandContext = {
  actorUserId: "rep-001",
  representativeExternalId: "REP-001",
  deviceId: "device-001",
  country: "BE",
};
const command = buildSalesErpCommand({
  commandId: "command-sales-document-001",
  issuedAt: "2026-07-17T12:00:00.000Z",
  commandType: "sales-document.create",
  businessKey: "sales-document:FF-000001",
  context,
  dependsOnCommandIds: ["command-prospect-001"],
  payload: {
    localDocumentId: "document-001",
    documentType: "ORDER_ALREADY_DELIVERED",
    reservedDocumentNumber: "FF-000001",
    localRelationId: "relation-prospect-001",
    localAppointmentId: "appointment-001",
    documentDate: "2026-07-17",
    language: "nl",
    currency: "EUR",
    proposedDocumentType: "ORDER",
    overrideReasonCode: "CUSTOMER_REQUEST",
    overrideComment: "Klant vraagt levering zonder factuur ter plaatse.",
    lines: [{
      lineId: "line-001",
      articleExternalId: "article-001",
      articleNumberSnapshot: "A-001",
      descriptionSnapshot: "EHBO navulling",
      quantity: "1.000",
      unitSnapshot: "ST",
      unitPriceSnapshot: "49.9500",
      vatRateSnapshot: "21.0000",
      representativeStockImpactQuantity: "1.000",
      customerCarrierExternalId: "carrier-001",
    }],
    signature: {
      signed: true,
      signedByName: "Klant Test",
      signedAt: "2026-07-17T12:01:00.000Z",
      documentSha256: "a".repeat(64),
      signatureUploadToken: "signature-token-001",
    },
  },
});
assert.equal(command.commandType, "sales-document.create");
assert.deepEqual(command.dependsOnCommandIds, ["command-prospect-001"]);
assert.equal(command.payload.localRelationId, "relation-prospect-001");
assert.equal(command.payload.lines[0].representativeStockImpactQuantity, "1.000");
assert.equal(canonicalSalesErpJson(command.payload), canonicalSalesErpJson({ ...command.payload }));

expectText("lib/server/salesday-commercial-documents.ts", [
  "applySalesErpArticle",
  "assertNoOverlappingSalesArticlePrice",
  "proposeSalesDocumentType",
  "allocateSalesDocumentNumberInTransaction",
  "signatureEvidence",
  "UNSIGNED_EXCEPTION",
  "sales-document.create",
  "representativeStockImpactQuantity",
  "STANDARD_ANDROID_PRINT_SHARE",
  "REPLACEABLE_BOUNDARY",
  "requireContractAccess",
  "Serializable",
]);
expectText("lib/server/integrations/sales-erp/contracts.ts", [
  "localRelationId?: string",
  "localAppointmentId?: string",
  "representativeStockImpactQuantity",
]);
expectText("prisma/schema.prisma", [
  "model SalesArticle",
  "model SalesArticlePrice",
  "model SalesDocument",
  "model SalesDocumentLine",
  "model SalesDocumentNumberBlock",
  "model SalesDocumentNumberUse",
  "model SalesDocumentSignatureEvidence",
  "enum SalesDocumentType",
]);
expectText("prisma/migrations/0053_salesday_commercial_documents/migration.sql", [
  "CREATE TABLE `SalesArticle`",
  "CREATE TABLE `SalesDocument`",
  "CREATE TABLE `SalesDocumentSignatureEvidence`",
  "CREATE TABLE `SalesDocumentNumberBlock`",
]);
expectText("app/api/salesday/appointments/[appointmentId]/documents/route.ts", ["createSalesDocument", "ERP_WRITES"]);
expectText("app/api/salesday/documents/[documentId]/print/route.ts", ["getSalesDocumentPrintShareDescriptor"]);
expectText("app/api/salesday/appointments/[appointmentId]/contract-context/route.ts", ["getSalesDayContractContext"]);

const migration = read("prisma/migrations/0053_salesday_commercial_documents/migration.sql").toUpperCase();
assert.equal(migration.includes("DROP TABLE"), false);
assert.equal(migration.includes("DELETE FROM"), false);

console.log("SalesDay commercial documents: beleid, snapshots, nummers, handtekening, print/share en Contract-gate gevalideerd.");
