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
  | "evaluations"
  | "contactMoments"
  | "retrainings"
  | "salesTrainings"
  | "helpRequests"
  | "timeline";

export type FicheTabId =
  | "overview"
  | "performanceCircle"
  | "personalCriteria"
  | "actionPoints"
  | "helpRequests"
  | "coachings"
  | "kpis"
  | "evaluations"
  | "contactMoments"
  | "retrainings"
  | "salesTrainings"
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
  { id: "evaluations", moduleCode: "TUSSENTIJDSE_EVALUATIES", permissions: ["menu.coaching.starterEvaluations"] },
  { id: "contactMoments", moduleCode: "CONTACTMOMENTEN", permissions: ["modulePreparation"] },
  { id: "retrainings", moduleCode: "RETRAININGEN", permissions: ["modulePreparation"] },
  { id: "salesTrainings", moduleCode: "SALESTRAININGEN", permissions: ["modulePreparation"] },
  { id: "helpRequests", moduleCode: "HULPAANVRAGEN", permissions: ["modulePreparation"] },
];

export const ficheTabDefinitions: { id: FicheTabId; translationKey: string; section: FicheSectionId }[] = [
  { id: "overview", translationKey: "myTeam.profile.tab.overview", section: "overview" },
  { id: "performanceCircle", translationKey: "myTeam.profile.tab.performanceCircle", section: "performanceCircle" },
  { id: "personalCriteria", translationKey: "myTeam.profile.tab.personalCriteria", section: "personalCriteria" },
  { id: "actionPoints", translationKey: "myTeam.profile.tab.actionPoints", section: "actionPoints" },
  { id: "helpRequests", translationKey: "myTeam.profile.tab.helpRequests", section: "helpRequests" },
  { id: "coachings", translationKey: "myTeam.profile.tab.coachings", section: "coachings" },
  { id: "kpis", translationKey: "myTeam.profile.tab.kpis", section: "kpis" },
  { id: "evaluations", translationKey: "myTeam.profile.tab.evaluations", section: "evaluations" },
  { id: "contactMoments", translationKey: "myTeam.profile.tab.contactMoments", section: "contactMoments" },
  { id: "retrainings", translationKey: "myTeam.profile.tab.retrainings", section: "retrainings" },
  { id: "salesTrainings", translationKey: "myTeam.profile.tab.salesTrainings", section: "salesTrainings" },
  { id: "timeline", translationKey: "myTeam.profile.tab.timeline", section: "timeline" },
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
