/**
 * Public boundary for Sales.
 *
 * Sales may consume inventory, contract and PST ports through these types.
 */
import type {
  ModuleActorContext,
  PstSalesPort,
  SalesContractPort,
  SalesInventoryPort,
} from "../contracts";

export type SalesModulePorts = {
  readonly inventory: SalesInventoryPort;
  readonly contract: SalesContractPort;
  readonly pst: PstSalesPort;
};

export type SalesModuleContext = {
  readonly actor: ModuleActorContext;
  readonly ports: SalesModulePorts;
};