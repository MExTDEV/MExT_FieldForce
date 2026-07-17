import { Prisma } from "@prisma/client";

import type { MockUser } from "@/lib/types";

import {
  applyInventoryMovementInTransaction,
  getOrCreateRepresentativeVehicleLocation,
  inventoryMovementKey,
  invalid,
} from "./primitives";

type InventorySalesDocumentType = "ORDER" | "ORDER_ALREADY_DELIVERED" | "INVOICE";

type InventorySalesDocumentLine = {
  id: string;
  articleExternalId: string;
  articleNumberSnapshot: string;
  quantity: Prisma.Decimal;
  unitSnapshot: string;
  representativeStockImpactQuantity: Prisma.Decimal;
  carrierRequired: boolean;
  customerCarrierExternalId: string | null;
};

export async function createInventoryMovementsForSalesDocumentInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    actor: MockUser;
    documentId: string;
    documentType: InventorySalesDocumentType;
    commandId: string;
    occurredAt: Date;
    lines: InventorySalesDocumentLine[];
  },
) {
  if (input.documentType === "ORDER") return [];
  const vehicle = await getOrCreateRepresentativeVehicleLocation(tx, {
    country: input.actor.country,
    representativeUserId: input.actor.id,
    name: "Voorraad vertegenwoordiger",
  });
  const movements = [];
  for (const line of input.lines) {
    if (line.representativeStockImpactQuantity.lte(0)) continue;
    const carrier = line.carrierRequired
      ? await resolveCarrierForDirectDelivery(tx, line.customerCarrierExternalId)
      : null;
    movements.push(await applyInventoryMovementInTransaction(tx, {
      movementKey: inventoryMovementKey("sales-document-direct-delivery", {
        documentId: input.documentId,
        lineId: line.id,
        commandId: input.commandId,
      }),
      type: carrier ? "SALES_CARRIER_DELIVERY" : "SALES_DELIVERY",
      actorUserId: input.actor.id,
      fromLocationId: vehicle.id,
      toLocationId: carrier?.id ?? null,
      articleExternalId: line.articleExternalId,
      articleNumberSnapshot: line.articleNumberSnapshot,
      quantity: line.representativeStockImpactQuantity,
      unit: line.unitSnapshot,
      sourceDocumentLineId: line.id,
      commandId: input.commandId,
      occurredAt: input.occurredAt,
    }));
  }
  return movements;
}

async function resolveCarrierForDirectDelivery(tx: Prisma.TransactionClient, customerCarrierExternalId: string | null) {
  if (!customerCarrierExternalId) invalid("Een drager is verplicht voor dit artikel.");
  const carrier = await tx.inventoryLocation.findFirst({
    where: {
      type: "CUSTOMER_CARRIER",
      OR: [{ externalId: customerCarrierExternalId }, { id: customerCarrierExternalId }],
    },
  });
  if (!carrier) invalid("De gekozen klantdrager bestaat niet.");
  if (carrier.archived) invalid("Een gearchiveerde drager kan geen nieuwe levering ontvangen.");
  return carrier;
}
