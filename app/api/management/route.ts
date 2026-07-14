import { ApiRequestError, badRequest, handleApi } from "@/lib/server/api";
import {
  deactivateCriterion,
  deactivateCriterionScopeLink,
  deactivateFocus,
  deactivateKpi,
  deactivateKpiTarget,
  deactivateTeam,
  getManagementConfiguration,
  listManagementKpis,
  listManagementTeams,
  type ManagementSection,
  saveCriterion,
  saveCriterionScopeLink,
  saveFocus,
  saveKpi,
  saveKpiTarget,
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
import { canAccessManagementSection } from "@/lib/management-access";
import type {
  Country,
  CriterionScopeType,
  FieldForcePermissionKey,
  KpiPeriodType,
  KpiTargetScope,
  Role,
  KpiEvaluationDirection,
  KpiUnit,
} from "@/lib/types";

const managementSections = new Set<ManagementSection>([
  "teams",
  "rollen",
  "kpis",
  "kapstok",
]);

export async function GET(request: Request) {
  return handleApi("api/management:get", async () => {
    const actor = await requireAuthenticatedRead();
    if (!actor) badRequest("Beheer vereist een aangemelde gebruiker.");
    const requestedSection = new URL(request.url).searchParams.get("section");
    const section = managementSections.has(requestedSection as ManagementSection)
      ? requestedSection as ManagementSection
      : undefined;
    if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
      const canViewTeams = canAccessManagementSection(actor, "teams");
      const canViewKpis = canAccessManagementSection(actor, "kpis");
      const canReadPartialConfiguration =
        (!section && (canViewTeams || canViewKpis)) ||
        (section === "teams" && canViewTeams) ||
        (section === "kpis" && canViewKpis);
      if (canReadPartialConfiguration) {
        const includeKpis = section ? section === "kpis" : canViewKpis;
        const includeTeams = section
          ? section === "teams" || section === "kpis"
          : canViewTeams || canViewKpis;
        const kpiConfiguration = includeKpis
          ? await listManagementKpis(actor)
          : { kpis: [], kpiCategories: [], kpiTypes: [], kpiTargetTypes: [] };
        return {
          teams: includeTeams ? await listManagementTeams(actor) : [],
          ...kpiConfiguration,
          focuses: [],
          roles: [],
        };
      }
      badRequest("Je hebt geen toegang tot deze beheerconfiguratie.");
    }
    return getManagementConfiguration(actor, section);
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
    const entity = String(payload.entity ?? "");
    if (entity === "team") {
      if (!canAccessManagementSection(actor, "teams")) {
        badRequest("Je hebt geen toegang tot teambeheer.");
      }
    } else if (entity === "kpi" || entity === "kpiTarget") {
      if (!canAccessManagementSection(actor, "kpis")) {
        badRequest("Je hebt geen toegang tot KPI-beheer.");
      }
    } else {
      requireRole(actor, ["ADMIN", "SUPER_ADMIN"]);
    }
    const permanent = operation === "delete" && payload.permanent === true;
    if (permanent) requireRole(actor, ["SUPER_ADMIN"]);
    let result: unknown;

    try {
      if (permanent) {
        result = await permanentlyDeleteManagementEntity(
          entity,
          String(payload.id),
          String(payload.confirmation ?? "")
        );
      } else if (entity === "team") {
        result = operation === "delete"
          ? await deactivateTeam(actor, String(payload.id))
          : await saveTeam(actor, {
              id: operation === "update" ? String(payload.id) : undefined,
              name: String(payload.name ?? ""),
              country: String(payload.country) as Country,
              primaryLeaderId:
                typeof payload.primaryLeaderId === "string"
                  ? payload.primaryLeaderId
                  : null,
            });
      } else if (entity === "kpi") {
        result = operation === "delete"
          ? await deactivateKpi(actor, String(payload.id))
          : await saveKpi(actor, {
              id: operation === "update" ? String(payload.id) : undefined,
              code: String(payload.code ?? ""),
              name: String(payload.name ?? ""),
              description: String(payload.description ?? ""),
              categoryId: typeof payload.categoryId === "string" ? payload.categoryId : null,
              typeId: typeof payload.typeId === "string" ? payload.typeId : null,
              targetTypeId: typeof payload.targetTypeId === "string" ? payload.targetTypeId : null,
              country: payload.country ? String(payload.country) as Country : null,
              teamId: typeof payload.teamId === "string" ? payload.teamId : null,
              userId: typeof payload.userId === "string" ? payload.userId : null,
              targetRole: payload.targetRole ? String(payload.targetRole) as Role : null,
              unit: String(payload.unit ?? "number") as KpiUnit,
              targetValue: parseRequiredKpiNumber(payload.targetValue, "Doelwaarde"),
              minValue: parseOptionalKpiNumber(payload.minValue, "Minimumwaarde"),
              maxValue: parseOptionalKpiNumber(payload.maxValue, "Maximumwaarde"),
              weight: parseOptionalKpiNumber(payload.weight, "Gewicht"),
              countsForReporting: payload.countsForReporting !== false,
              countsForPerformanceCircle: payload.countsForPerformanceCircle !== false,
              includeInStarterEvaluations: payload.includeInStarterEvaluations === true,
              sortOrder: Number(payload.sortOrder ?? 0),
              validFrom: parseRequiredDate(payload.validFrom, "Begindatum"),
              validUntil: parseOptionalDate(payload.validUntil, "Einddatum"),
              evaluationDirection: String(payload.evaluationDirection ?? "HIGHER_IS_BETTER") as KpiEvaluationDirection,
              active: payload.active !== false,
            });
      } else if (entity === "kpiTarget") {
        result = operation === "delete"
          ? await deactivateKpiTarget(actor, String(payload.id))
          : await saveKpiTarget(actor, {
              id: operation === "update" ? String(payload.id) : undefined,
              kpiDefinitionId: String(payload.kpiDefinitionId ?? ""),
              targetTypeId: typeof payload.targetTypeId === "string" ? payload.targetTypeId : null,
              scope: String(payload.scope ?? "GLOBAL") as KpiTargetScope,
              country: payload.country ? String(payload.country) as Country : null,
              teamId: typeof payload.teamId === "string" ? payload.teamId : null,
              userId: typeof payload.userId === "string" ? payload.userId : null,
              role: payload.role ? String(payload.role) as Role : null,
              periodType: String(payload.periodType ?? "MONTH") as KpiPeriodType,
              periodStart: parseRequiredDate(payload.periodStart, "Startperiode"),
              periodEnd: parseRequiredDate(payload.periodEnd, "Eindperiode"),
              targetValue: parseRequiredKpiNumber(payload.targetValue, "Doelwaarde"),
              active: payload.active !== false,
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
      } else if (entity === "criterionScope") {
        result = operation === "delete"
          ? await deactivateCriterionScopeLink(actor, String(payload.id))
          : await saveCriterionScopeLink(actor, {
              id: operation === "update" ? String(payload.id) : undefined,
              criterionId: String(payload.criterionId ?? ""),
              scopeType: String(payload.scopeType ?? "GLOBAL") as CriterionScopeType,
              country: payload.country ? String(payload.country) as Country : null,
              teamId: typeof payload.teamId === "string" ? payload.teamId : null,
              userId: typeof payload.userId === "string" ? payload.userId : null,
              sortOrder: Number(payload.sortOrder ?? 0),
            });
      } else if (entity === "role" && operation === "update") {
        result = await saveRolePermissions(
          actor,
          String(payload.role) as Role,
          (payload.permissions ?? {}) as Partial<Record<FieldForcePermissionKey, boolean>>,
          typeof payload.active === "boolean" ? payload.active : undefined
        );
      } else {
        badRequest("Onbekende beheeractie.");
      }
    } catch (error) {
      handleManagementMutationError(entity, error);
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

function parseRequiredDate(value: unknown, label: string) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`${label} is verplicht.`);
  }
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is ongeldig.`);
  return date;
}

function parseOptionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is ongeldig.`);
  return date;
}

function handleManagementMutationError(entity: string, error: unknown): never {
  if (error instanceof ApiRequestError) throw error;

  const code = getPrismaErrorCode(error);
  if (entity === "team" && code === "P2002") {
    badRequest("Er bestaat al een team met deze naam in dit land.");
  }
  if (entity === "criterionScope" && code === "P2002") {
    badRequest("Deze kapstokkoppeling bestaat al voor dit criterium.");
  }
  if (code === "P2003") {
    badRequest("De gekozen koppeling is ongeldig of bestaat niet meer.");
  }

  if (error instanceof Error && isSafeManagementMessage(error.message)) {
    badRequest(error.message);
  }

  throw error;
}

function getPrismaErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isSafeManagementMessage(message: string) {
  return (
    message.endsWith(" is verplicht.") ||
    message.endsWith(" is ongeldig.") ||
    message.endsWith(" moet numeriek zijn.") ||
    [
      "Deze configuratie valt buiten je landenscope.",
      "Deze KPI valt buiten je toegestane scope.",
      "Deze doelwaarde valt buiten je toegestane scope.",
      "Deze doelwaarde valt buiten de scope van de KPI.",
      "Teamnaam is verplicht.",
      "Er bestaat al een team met deze naam in dit land.",
      "De gekozen teamleider is niet actief in dit land.",
      "Verplaats eerst de bestaande teamleden voordat je het land van dit team wijzigt.",
      "Selecteer een geldige eenheid.",
      "Selecteer een geldige beoordelingsrichting.",
      "Selecteer een geldige KPI-scope.",
      "Selecteer een geldige KPI-periode.",
      "Selecteer een land voor deze KPI.",
      "Selecteer een team voor deze KPI.",
      "Selecteer een gebruiker voor deze KPI.",
      "Selecteer een rol voor deze KPI.",
      "Selecteer een land voor deze doelwaarde.",
      "Selecteer een team voor deze doelwaarde.",
      "Selecteer een gebruiker voor deze doelwaarde.",
      "Selecteer een rol voor deze doelwaarde.",
      "Het gekozen team bestaat niet meer.",
      "De gekozen gebruiker bestaat niet meer.",
      "Globale KPI's kunnen alleen door groepsbeheer worden aangemaakt.",
      "Globale KPI-doelwaarden kunnen alleen door groepsbeheer worden aangemaakt.",
      "Je hebt geen toegang tot KPI-beheer.",
      "Je mag geen KPI's aanmaken.",
      "Je mag KPI's niet beheren.",
      "Je mag KPI-doelwaarden niet beheren.",
      "Gewicht moet een positief numeriek getal zijn.",
      "Einddatum mag niet voor begindatum liggen.",
      "Er bestaat al een actieve doelwaarde voor deze KPI, scope en periode.",
      "Minimumwaarde mag niet hoger zijn dan maximumwaarde.",
      "Doelwaarde mag niet lager zijn dan minimumwaarde.",
      "Doelwaarde mag niet hoger zijn dan maximumwaarde.",
      "De globale kapstok kan alleen door een Super Admin worden gewijzigd.",
      "Je mag kapstokkoppelingen niet beheren.",
      "Selecteer een geldige kapstokscope.",
      "Selecteer een land voor deze kapstokkoppeling.",
      "Selecteer een team voor deze kapstokkoppeling.",
      "Selecteer een gebruiker voor deze kapstokkoppeling.",
      "Deze kapstokkoppeling valt buiten je toegestane scope.",
      "Het gekozen kapstokcriterium bestaat niet meer.",
      "De gekozen kapstokkoppeling bestaat niet meer.",
      "Globale kapstokkoppelingen kunnen alleen door een Super Admin worden gewijzigd.",
      "Super Admin vereist.",
      "Rollen en globale rechten kunnen alleen door een Super Admin worden gewijzigd.",
      "Onbekende rol.",
    ].includes(message)
  );
}
