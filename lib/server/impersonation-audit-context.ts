import { AsyncLocalStorage } from "node:async_hooks";

export type ImpersonationAuditContext = {
  actorUserId: string;
  effectiveUserId: string;
  impersonationSessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

const storage = new AsyncLocalStorage<ImpersonationAuditContext | null>();

export function bindImpersonationAuditContext(context: ImpersonationAuditContext | null) {
  storage.enterWith(context);
}

export function getImpersonationAuditContext() {
  return storage.getStore() ?? null;
}
