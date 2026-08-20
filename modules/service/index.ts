/**
 * Public boundary for Service.
 */
import type {
  ModuleActorContext,
  ServiceContractPort,
  ServiceInventoryPort,
} from "../contracts";

export type ServiceModulePorts = {
  readonly inventory: ServiceInventoryPort;
  readonly contract: ServiceContractPort;
};

export type ServiceModuleContext = {
  readonly actor: ModuleActorContext;
  readonly ports: ServiceModulePorts;
};