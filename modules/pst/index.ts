/**
 * Public boundary for PST.
 */
import type { ModuleActorContext, PstSalesPort } from "../contracts";

export type PstModulePorts = {
  readonly sales: PstSalesPort;
};

export type PstModuleContext = {
  readonly actor: ModuleActorContext;
  readonly ports: PstModulePorts;
};