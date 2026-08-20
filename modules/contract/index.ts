/**
 * Public boundary for Contract.
 *
 * Sales and Service consume contract decisions through dedicated ports.
 */
import type {
  ModuleAuditPort,
  PlatformModuleAccessPort,
  SalesContractPort,
  ServiceContractPort,
} from "../contracts";

export type ContractModulePorts = {
  readonly sales: SalesContractPort;
  readonly service: ServiceContractPort;
  readonly access: PlatformModuleAccessPort;
  readonly audit: ModuleAuditPort;
};