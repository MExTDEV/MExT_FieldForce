import { can, canAccessRepresentative } from "@/lib/permissions";
import type {
  AppModuleCode,
  AppModuleConfig,
  FieldForcePermissionKey,
  MockUser,
  Representative,
} from "@/lib/types";

export type FicheSectionId =
  | "overview"
  | "coachings"
  | "personalCriteria"
  | "actionPoints"
  | "performanceCircle"
  | "kpis"
  | "contactMoments"
  | "retrainings"
  | "salesTrainings"
  | "helpRequests"
  | "timeline"
  | "productAnalysis";

export type FicheTabId =
  | "overview"
  | "performanceCircle"
  | "personalCriteria"
  | "kpis"
  | "coachings"
  | "contactMoments"
  | "retrainings"
  | "salesTrainings"
  | "helpRequests"
  | "actionPoints"
  | "productAnalysis"
  | "timeline";

type FicheVisibilityContext = {
  user: MockUser;
  representative: Representative;
  modules: AppModuleConfig[];
};

type FicheSectionRule = {
  id: FicheSectionId;
  moduleCode?: AppModuleCode;
  permissions?: FieldForcePermissionKey[];
};

export const ficheSectionRules: FicheSectionRule[] = [
  { id: "overview" },
  { id: "coachings", moduleCode: "BEGELEIDINGEN", permissions: ["moduleVisitRecord"] },
  { id: "personalCriteria", moduleCode: "BEGELEIDINGEN", permissions: ["moduleVisitRecord"] },
  { id: "actionPoints", moduleCode: "ACTIEPUNTEN", permissions: ["modulePreparation"] },
  { id: "performanceCircle", moduleCode: "RAPPORTERING", permissions: ["moduleReporting", "performanceView"] },
  { id: "kpis", moduleCode: "RAPPORTERING", permissions: ["moduleReporting", "performanceScoresView"] },
  { id: "contactMoments", moduleCode: "CONTACTMOMENTEN", permissions: ["modulePreparation"] },
  { id: "retrainings", moduleCode: "RETRAININGEN", permissions: ["modulePreparation"] },
  { id: "salesTrainings", moduleCode: "SALESTRAININGEN", permissions: ["modulePreparation"] },
  { id: "helpRequests", moduleCode: "HULPAANVRAGEN", permissions: ["modulePreparation"] },
  { id: "productAnalysis", moduleCode: "RAPPORTERING", permissions: ["moduleReporting", "performanceScoresView"] },
];

export const ficheTabDefinitions: { id: FicheTabId; label: string; section: FicheSectionId }[] = [
  { id: "overview", label: "overzicht", section: "overview" },
  { id: "performanceCircle", label: "Prestatiecirkel", section: "performanceCircle" },
  { id: "personalCriteria", label: "persoonlijke criteria", section: "personalCriteria" },
  { id: "kpis", label: "KPI's", section: "kpis" },
  { id: "coachings", label: "begeleidingen", section: "coachings" },
  { id: "contactMoments", label: "contactmomenten", section: "contactMoments" },
  { id: "retrainings", label: "retrainingen", section: "retrainings" },
  { id: "salesTrainings", label: "sales trainingen", section: "salesTrainings" },
  { id: "helpRequests", label: "hulpaanvragen", section: "helpRequests" },
  { id: "actionPoints", label: "actiepunten", section: "actionPoints" },
  { id: "productAnalysis", label: "productanalyse", section: "productAnalysis" },
  { id: "timeline", label: "tijdlijn", section: "timeline" },
];

const timelineSections: FicheSectionId[] = [
  "coachings",
  "contactMoments",
  "retrainings",
  "salesTrainings",
  "helpRequests",
];

function moduleEnabled(modules: AppModuleConfig[], code: AppModuleCode) {
  return modules.some((module) => module.code === code && module.enabled);
}

function ruleFor(section: FicheSectionId) {
  return ficheSectionRules.find((rule) => rule.id === section);
}

export function canViewFicheSection(
  section: FicheSectionId,
  context: FicheVisibilityContext
): boolean {
  if (!canAccessRepresentative(context.user, context.representative)) return false;
  if (section === "timeline") {
    return timelineSections.some((timelineSection) =>
      canViewFicheSection(timelineSection, context)
    );
  }

  const rule = ruleFor(section);
  if (!rule) return false;
  if (rule.moduleCode && !moduleEnabled(context.modules, rule.moduleCode)) return false;
  if (rule.permissions?.some((permission) => !can(context.user, permission))) return false;
  return true;
}

export function getVisibleFicheSections(context: FicheVisibilityContext) {
  return new Set(
    ficheTabDefinitions
      .map((tab) => tab.section)
      .filter((section) => canViewFicheSection(section, context))
  );
}

export function getVisibleFicheTabs(context: FicheVisibilityContext) {
  return ficheTabDefinitions.filter((tab) =>
    canViewFicheSection(tab.section, context)
  );
}

export type FicheTimelineItemType =
  | "begeleiding"
  | "contactmoment"
  | "retraining"
  | "sales_training"
  | "hulpaanvraag";

export function getFicheTimelineItemTypes(
  visibleSections: Set<FicheSectionId>
): FicheTimelineItemType[] {
  return [
    visibleSections.has("coachings") && "begeleiding",
    visibleSections.has("contactMoments") && "contactmoment",
    visibleSections.has("retrainings") && "retraining",
    visibleSections.has("salesTrainings") && "sales_training",
    visibleSections.has("helpRequests") && "hulpaanvraag",
  ].filter(Boolean) as FicheTimelineItemType[];
}
