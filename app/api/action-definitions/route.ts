import { badRequest, forbidden, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser, requirePermission, requireRole } from "@/lib/server/authenticated-user";
import { fromPriority, listVisibleActionDefinitions, saveActionDefinition, softDeleteActionDefinition } from "@/lib/server/action-definitions";
import type { ActionScope } from "@prisma/client";
import type { Country } from "@/lib/types";
import { isAppModuleEnabled } from "@/lib/server/modules";

export async function GET(request: Request) {
  return handleApi("api/action-definitions:get", async () => {
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    requireRole(actor, ["REPRESENTATIVE", "SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"]);
    await requireActionPointsAccess(actor);
    const definitions = await listVisibleActionDefinitions(actor);
    return {
      definitions: definitions.map((item) => ({
        ...item,
        targetValue: item.targetValue === null ? undefined : Number(item.targetValue),
        priority: fromPriority(item.priority),
        validFrom: item.validFrom.toISOString().slice(0, 10),
        validUntil: item.validUntil?.toISOString().slice(0, 10),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  });
}

async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  return handleApi(`api/action-definitions:${method.toLowerCase()}`, async () => {
    const body = await request.json() as Record<string, unknown>;
    const actor = await requireAuthenticatedUser(String(body.actorId ?? ""));
    requireRole(actor, ["SALES_LEADER", "SALES_MANAGER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"]);
    await requireActionPointsAccess(actor);
    if (method === "DELETE") return { definition: await softDeleteActionDefinition(actor, String(body.id)) };
    const target = body.targetValue === "" || body.targetValue === undefined ? undefined : Number(body.targetValue);
    if (target !== undefined && !Number.isFinite(target)) badRequest("Target moet numeriek zijn.");
    return { definition: await saveActionDefinition(actor, {
      id: method === "PATCH" ? String(body.id) : undefined, title: String(body.title ?? ""), description: String(body.description ?? ""),
      tipsAndTricks: String(body.tipsAndTricks ?? ""), targetValue: target, priority: String(body.priority ?? "normaal") as "laag" | "normaal" | "hoog",
      scope: String(body.scope ?? "USER") as ActionScope, country: body.country as Country | undefined,
      teamId: body.teamId ? String(body.teamId) : undefined, userId: body.userId ? String(body.userId) : undefined,
      validFrom: String(body.validFrom ?? ""), validUntil: body.validUntil ? String(body.validUntil) : undefined, active: body.active !== false,
    }) };
  });
}
export async function POST(request: Request) { return mutate(request, "POST"); }
export async function PATCH(request: Request) { return mutate(request, "PATCH"); }
export async function DELETE(request: Request) { return mutate(request, "DELETE"); }

async function requireActionPointsAccess(actor: Awaited<ReturnType<typeof requireAuthenticatedUser>>) {
  requirePermission(actor, "modulePreparation");
  requirePermission(actor, "menu.coaching.actionPoints");
  if (!(await isAppModuleEnabled("ACTIEPUNTEN"))) {
    forbidden("Actiepuntenmodule is niet actief.");
  }
}
