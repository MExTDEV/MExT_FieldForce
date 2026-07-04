import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser, requireRole } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import type { ActionScope } from "@prisma/client";

export async function PUT(request: Request) {
  return handleApi("api/action-definitions/target-override", async () => {
    const body = await request.json() as { actorId?: string; actionDefinitionId?: string; scope?: ActionScope; country?: string; teamId?: string; userId?: string; targetValue?: unknown };
    const actor = await requireAuthenticatedUser(body.actorId);
    requireRole(actor, ["SALES_LEADER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"]);
    const targetValue = Number(body.targetValue);
    if (!Number.isFinite(targetValue)) badRequest("Target moet numeriek zijn.");
    const scope = body.scope ?? "USER";
    const scopeKey = scope === "USER" && body.userId ? `USER:${body.userId}` : scope === "TEAM" && body.teamId ? `TEAM:${body.teamId}` : scope === "COUNTRY" && body.country ? `COUNTRY:${body.country}` : undefined;
    if (!scopeKey) badRequest("Een geldige land-, team- of gebruikersscope is verplicht.");
    if (!["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role) && body.country && body.country !== actor.country) badRequest("Deze override valt buiten je landenscope.");
    const override = await prisma.actionTargetOverride.upsert({
      where: { actionDefinitionId_scopeKey: { actionDefinitionId: body.actionDefinitionId ?? "", scopeKey } },
      update: { targetValue, country: body.country as never, teamId: body.teamId, userId: body.userId },
      create: { actionDefinitionId: body.actionDefinitionId ?? "", scope, scopeKey, targetValue, country: body.country as never, teamId: body.teamId, userId: body.userId },
    });
    return { override: { ...override, targetValue: Number(override.targetValue) } };
  });
}
