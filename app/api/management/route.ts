import { badRequest, handleApi } from "@/lib/server/api";
import {
  deactivateCriterion,
  deactivateFocus,
  deactivateKpi,
  deactivateTeam,
  getManagementConfiguration,
  saveCriterion,
  saveFocus,
  saveKpi,
  saveRolePermissions,
  saveTeam,
} from "@/lib/server/management";
import {
  permanentlyDeleteCriterion,
  permanentlyDeleteFocus,
  permanentlyDeleteKpi,
  permanentlyDeleteTeam,
} from "@/lib/server/permanent-delete";
import {
  requireAuthenticatedRead,
  requireAuthenticatedUser,
  requireRole,
} from "@/lib/server/authenticated-user";
import { writeAuditLog } from "@/lib/server/audit";
import { parseOptionalKpiNumber, parseRequiredKpiNumber } from "@/lib/kpi-settings";
import type {
  Country,
  FieldForcePermissionKey,
  Role,
  KpiEvaluationDirection,
  KpiUnit,
} from "@/lib/types";

export async function GET() {
  return handleApi("api/management:get", async () => {
    const actor = await requireAuthenticatedRead();
    if (!actor) badRequest("Beheer vereist een aangemelde gebruiker.");
    requireRole(actor, ["ADMIN", "SUPER_ADMIN"]);
    return getManagementConfiguration(actor);
  }, "Beheerconfiguratie kon niet worden geladen.");
}

export async function POST(request: Request) {
  return mutate(request, "create");
}

export async function PATCH(request: Request) {
  return mutate(request, "update");
}

export async function DELETE(request: Request) {
  return mutate(request, "delete");
}

async function mutate(request: Request, operation: "create" | "update" | "delete") {
  return handleApi(`api/management:${operation}`, async () => {
    const payload = await request.json() as Record<string, unknown>;
    const actor = await requireAuthenticatedUser(
      typeof payload.actorId === "string" ? payload.actorId : undefined
    );
    requireRole(actor, ["ADMIN", "SUPER_ADMIN"]);
    const entity = String(payload.entity ?? "");
    const permanent = operation === "delete" && payload.permanent === true;
    if (permanent) requireRole(actor, ["SUPER_ADMIN"]);
    let result: unknown;

    if (permanent) {
      try {
        result = await permanentlyDeleteManagementEntity(
          entity,
          String(payload.id),
          String(payload.confirmation ?? "")
        );
      } catch (error) {
        badRequest(error instanceof Error ? error.message : "Permanent verwijderen is mislukt.");
      }
    } else if (entity === "team") {
      result = operation === "delete"
        ? await deactivateTeam(actor, String(payload.id))
        : await saveTeam(actor, {
            id: operation === "update" ? String(payload.id) : undefined,
            name: String(payload.name ?? ""),
            country: String(payload.country) as Country,
            primaryLeaderId: String(payload.primaryLeaderId ?? ""),
          });
    } else if (entity === "kpi") {
      result = operation === "delete"
        ? await deactivateKpi(actor, String(payload.id))
        : await saveKpi(actor, {
            id: operation === "update" ? String(payload.id) : undefined,
            code: String(payload.code ?? ""),
            name: String(payload.name ?? ""),
            description: String(payload.description ?? ""),
            country: payload.country ? String(payload.country) as Country : null,
            unit: String(payload.unit ?? "number") as KpiUnit,
            targetValue: parseRequiredKpiNumber(payload.targetValue, "Doelwaarde"),
            minValue: parseOptionalKpiNumber(payload.minValue, "Minimumwaarde"),
            maxValue: parseOptionalKpiNumber(payload.maxValue, "Maximumwaarde"),
            evaluationDirection: String(payload.evaluationDirection ?? "HIGHER_IS_BETTER") as KpiEvaluationDirection,
          });
    } else if (entity === "focus") {
      result = operation === "delete"
        ? await deactivateFocus(actor, String(payload.id))
        : await saveFocus(actor, {
            id: operation === "update" ? String(payload.id) : undefined,
            code: String(payload.code ?? ""),
            name: String(payload.name ?? ""),
            sortOrder: Number(payload.sortOrder ?? 0),
          });
    } else if (entity === "criterion") {
      result = operation === "delete"
        ? await deactivateCriterion(actor, String(payload.id))
        : await saveCriterion(actor, {
            id: operation === "update" ? String(payload.id) : undefined,
            focusId: String(payload.focusId ?? ""),
            name: String(payload.name ?? ""),
            sortOrder: Number(payload.sortOrder ?? 0),
          });
    } else if (entity === "role" && operation === "update") {
      await saveRolePermissions(
        actor,
        String(payload.role) as Role,
        (payload.permissions ?? {}) as Partial<Record<FieldForcePermissionKey, boolean>>
      );
      result = { role: payload.role };
    } else {
      badRequest("Onbekende beheeractie.");
    }

    await writeAuditLog({
      actorId: actor.id,
      entityType: `Management:${entity}`,
      entityId: String(payload.id ?? ("id" in (result as object) ? (result as { id: string }).id : entity)),
      action: permanent ? `management.${entity}.permanentDelete` : `management.${entity}.${operation}`,
      newValue: result,
    });
    return { ok: true, result };
  }, "De beheerwijziging kon niet worden opgeslagen.");
}

function permanentlyDeleteManagementEntity(entity: string, id: string, confirmation: string) {
  if (entity === "team") return permanentlyDeleteTeam(id, confirmation);
  if (entity === "kpi") return permanentlyDeleteKpi(id, confirmation);
  if (entity === "focus") return permanentlyDeleteFocus(id, confirmation);
  if (entity === "criterion") return permanentlyDeleteCriterion(id, confirmation);
  badRequest("Deze configuratie kan niet permanent worden verwijderd.");
}
