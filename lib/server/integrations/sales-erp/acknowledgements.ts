import { ErpOutboxStatus, type Prisma } from "@prisma/client";

import {
  SALES_ERP_SCHEMA_VERSION,
  type SalesErpCommand,
  type SalesErpCommandAcknowledgement,
  type SalesErpProvider,
} from "./contracts";
import { SalesErpError } from "./errors";
import { canonicalSalesErpJson } from "./idempotency";

export function assertSalesErpAcknowledgement(
  provider: SalesErpProvider,
  command: SalesErpCommand,
  acknowledgement: SalesErpCommandAcknowledgement,
) {
  const mismatch =
    acknowledgement.schemaVersion !== SALES_ERP_SCHEMA_VERSION ||
    acknowledgement.provider !== provider ||
    acknowledgement.commandId !== command.commandId ||
    acknowledgement.idempotencyKey !== command.idempotencyKey;
  if (mismatch) {
    throw new SalesErpError({
      code: "PROVIDER_REJECTED",
      message: "ERP acknowledgement does not match the submitted command",
      retryable: true,
      details: {
        expectedCommandId: command.commandId,
        actualCommandId: acknowledgement.commandId,
        expectedProvider: provider,
        actualProvider: acknowledgement.provider,
      },
    });
  }
  const acknowledgedAt = new Date(acknowledgement.acknowledgedAt);
  if (Number.isNaN(acknowledgedAt.getTime())) {
    throw new SalesErpError({
      code: "PROVIDER_REJECTED",
      message: "ERP acknowledgement contains an invalid timestamp",
      retryable: true,
    });
  }
}

export function salesErpAcknowledgementUpdate(
  acknowledgement: SalesErpCommandAcknowledgement,
  retryAt: Date,
): Prisma.ErpOutboxCommandUpdateManyMutationInput {
  const status =
    acknowledgement.status === "ACCEPTED"
      ? ErpOutboxStatus.ACCEPTED
      : acknowledgement.status === "REJECTED"
        ? ErpOutboxStatus.REJECTED
        : ErpOutboxStatus.RETRYABLE;

  return {
    status,
    acknowledgedAt: new Date(acknowledgement.acknowledgedAt),
    externalEntityId: acknowledgement.externalEntityId,
    acknowledgedSourceVersion: acknowledgement.sourceVersion,
    acknowledgementJson: canonicalSalesErpJson(acknowledgement),
    lastErrorCode: acknowledgement.errorCode,
    lastErrorMessage: acknowledgement.errorMessage,
    nextAttemptAt: status === ErpOutboxStatus.RETRYABLE ? retryAt : null,
    leaseOwner: null,
    leaseExpiresAt: null,
  };
}
