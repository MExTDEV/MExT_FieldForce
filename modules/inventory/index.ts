/**
 * Public boundary for Inventory.
 *
 * Inventory owns stock movement and consumption workflows; consumers use the
 * ports from the shared contract layer instead of importing internals.
 */
import type {
  ModuleAuditPort,
  PlatformModuleAccessPort,
  SalesInventoryPort,
  ServiceInventoryPort,
} from "../contracts";

export type InventoryModulePorts = {
  readonly sales: SalesInventoryPort;
  readonly service: ServiceInventoryPort;
  readonly access: PlatformModuleAccessPort;
  readonly audit: ModuleAuditPort;
};