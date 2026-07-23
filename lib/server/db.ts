import { PrismaClient } from "@prisma/client";
import { getImpersonationAuditContext } from "@/lib/server/impersonation-audit-context";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }).$extends({
    query: {
      auditLog: {
        async create({ args, query }) {
          const context = getImpersonationAuditContext();
          if (context) {
            args.data = {
              ...args.data,
              userId: context.actorUserId,
              effectiveUserId: context.effectiveUserId,
              impersonationSessionId: context.impersonationSessionId,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            } as typeof args.data;
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
