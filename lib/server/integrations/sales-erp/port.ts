import type {
  SalesErpBootstrapPage,
  SalesErpBootstrapRequest,
  SalesErpBootstrapResource,
  SalesErpCapabilities,
  SalesErpCommand,
  SalesErpCommandAcknowledgement,
  SalesErpEventPage,
  SalesErpProvider,
  SalesErpReconciliationRequest,
  SalesErpReconciliationResult,
} from "./contracts";

export type SalesErpEventRequest = {
  cursor?: string;
  limit?: number;
};

/**
 * Provider-neutral boundary between SalesDay and an ERP implementation.
 *
 * Transport concerns (HTTP, queues, webhooks and authentication) deliberately
 * stay outside this port. A BC/NAV or Odoo adapter must translate its native
 * protocol to these versioned contracts.
 */
export interface SalesErpPort {
  readonly provider: SalesErpProvider;

  getCapabilities(): Promise<SalesErpCapabilities>;

  getBootstrapPage<K extends SalesErpBootstrapResource>(
    request: SalesErpBootstrapRequest<K>,
  ): Promise<SalesErpBootstrapPage<K>>;

  getEvents(request?: SalesErpEventRequest): Promise<SalesErpEventPage>;

  submitCommand(command: SalesErpCommand): Promise<SalesErpCommandAcknowledgement>;

  getCommandStatus(commandId: string): Promise<SalesErpCommandAcknowledgement | undefined>;

  reconcile(request: SalesErpReconciliationRequest): Promise<SalesErpReconciliationResult>;
}
