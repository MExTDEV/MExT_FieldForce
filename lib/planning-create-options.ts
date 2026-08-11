import { canCreateCoachingIntervention, canCreateIntervention } from "@/lib/permissions";
import { canAccessCoachingModuleNavigation } from "@/lib/navigation-access";
import { canStartStarterEvaluation } from "@/lib/starter-evaluations";
import type { AppModuleCode, MockUser } from "@/lib/types";

export type PlanningCreateType =
  | "coaching"
  | "contact"
  | "retraining"
  | "salesTraining"
  | "helpRequest"
  | "starterEvaluation";

export type PlanningCreateOption = {
  type: PlanningCreateType;
  moduleCode: AppModuleCode;
  titleKey: string;
  descriptionKey: string;
  href: string;
};

type PlanningCreateDefinition = {
  type: PlanningCreateType;
  moduleCode: AppModuleCode;
  titleKey: string;
  descriptionKey: string;
  baseHref: string;
  canCreate: (user: MockUser) => boolean;
  includeDate: boolean;
  extraParams?: Record<string, string>;
};

const planningCreateDefinitions: readonly PlanningCreateDefinition[] = [
  {
    type: "coaching",
    moduleCode: "BEGELEIDINGEN",
    titleKey: "coaching.planning.create.coaching.title",
    descriptionKey: "coaching.planning.create.coaching.description",
    baseHref: "/begeleidingen/nieuw",
    canCreate: canCreateCoachingIntervention,
    includeDate: true,
  },
  {
    type: "contact",
    moduleCode: "CONTACTMOMENTEN",
    titleKey: "coaching.planning.create.contact.title",
    descriptionKey: "coaching.planning.create.contact.description",
    baseHref: "/contactmomenten/nieuw",
    canCreate: canCreateIntervention,
    includeDate: true,
  },
  {
    type: "retraining",
    moduleCode: "RETRAININGEN",
    titleKey: "coaching.planning.create.retraining.title",
    descriptionKey: "coaching.planning.create.retraining.description",
    baseHref: "/retrainingen/nieuw",
    canCreate: canInitiateTraining,
    includeDate: true,
  },
  {
    type: "salesTraining",
    moduleCode: "SALESTRAININGEN",
    titleKey: "coaching.planning.create.salesTraining.title",
    descriptionKey: "coaching.planning.create.salesTraining.description",
    baseHref: "/sales-trainingen/nieuw",
    canCreate: canInitiateTraining,
    includeDate: true,
  },
  {
    type: "helpRequest",
    moduleCode: "HULPAANVRAGEN",
    titleKey: "coaching.planning.create.helpRequest.title",
    descriptionKey: "coaching.planning.create.helpRequest.description",
    baseHref: "/hulpaanvragen/nieuw",
    canCreate: (user: MockUser) => user.role === "REPRESENTATIVE",
    includeDate: false,
  },
  {
    type: "starterEvaluation",
    moduleCode: "TUSSENTIJDSE_EVALUATIES",
    titleKey: "coaching.planning.create.starterEvaluation.title",
    descriptionKey: "coaching.planning.create.starterEvaluation.description",
    baseHref: "/tussentijdse-evaluaties",
    canCreate: canStartStarterEvaluation,
    includeDate: true,
    extraParams: { new: "1" },
  },
];

export function planningCreateOptions(input: {
  user: MockUser;
  isModuleEnabled: (code: AppModuleCode) => boolean;
  selectedDate?: string;
}) {
  return planningCreateDefinitions
    .filter((definition) =>
      input.isModuleEnabled(definition.moduleCode) &&
      canAccessCoachingModuleNavigation(input.user, definition.moduleCode) &&
      definition.canCreate(input.user)
    )
    .map((definition) => ({
      type: definition.type,
      moduleCode: definition.moduleCode,
      titleKey: definition.titleKey,
      descriptionKey: definition.descriptionKey,
      href: createHref(definition.baseHref, {
        ...definition.extraParams,
        ...(definition.includeDate && input.selectedDate ? { date: input.selectedDate } : {}),
      }),
    }));
}

export function hasActivePlanningCreateModules(isModuleEnabled: (code: AppModuleCode) => boolean) {
  return planningCreateDefinitions.some((definition) => isModuleEnabled(definition.moduleCode));
}

export function isPlanningDateParam(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function canInitiateTraining(user: MockUser) {
  return ["REPRESENTATIVE", "SALES_LEADER", "COUNTRY_MANAGER", "GROUP_MANAGER", "SUPER_ADMIN"].includes(user.role);
}

function createHref(baseHref: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${baseHref}?${query}` : baseHref;
}
