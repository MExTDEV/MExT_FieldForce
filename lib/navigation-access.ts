import { can, canViewTeamDashboard } from "@/lib/permissions";
import type {
  AppModuleCode,
  FieldForcePermissionKey,
  MockUser,
} from "@/lib/types";

export type CoachingModuleNavigationRule = {
  menuPermission: FieldForcePermissionKey;
  modulePermission: FieldForcePermissionKey;
};

export const coachingModuleNavigationRules: Record<
  AppModuleCode,
  CoachingModuleNavigationRule
> = {
  PLANNING: {
    menuPermission: "menu.coaching.planning",
    modulePermission: "moduleAgenda",
  },
  BEGELEIDINGEN: {
    menuPermission: "menu.coaching.coachings",
    modulePermission: "moduleVisitRecord",
  },
  CONTACTMOMENTEN: {
    menuPermission: "menu.coaching.contacts",
    modulePermission: "modulePreparation",
  },
  RETRAININGEN: {
    menuPermission: "menu.coaching.retrainings",
    modulePermission: "modulePreparation",
  },
  SALESTRAININGEN: {
    menuPermission: "menu.coaching.trainings",
    modulePermission: "modulePreparation",
  },
  HULPAANVRAGEN: {
    menuPermission: "menu.coaching.help",
    modulePermission: "modulePreparation",
  },
  ACTIEPUNTEN: {
    menuPermission: "menu.coaching.actionPoints",
    modulePermission: "modulePreparation",
  },
  RAPPORTERING: {
    menuPermission: "menu.coaching.reporting",
    modulePermission: "moduleReporting",
  },
};

export function canAccessDashboard(user: MockUser) {
  return (
    can(user, "menu.coaching.enabled") &&
    can(user, "moduleDashboard") &&
    can(user, "menu.coaching.dashboard")
  );
}

export function canAccessMyTeamNavigation(user: MockUser) {
  return (
    can(user, "menu.coaching.enabled") &&
    canViewTeamDashboard(user) &&
    can(user, "moduleMyTeam") &&
    can(user, "menu.coaching.myTeam")
  );
}

export function canAccessCoachingModuleNavigation(
  user: MockUser,
  code: AppModuleCode
) {
  const rule = coachingModuleNavigationRules[code];
  return (
    can(user, "menu.coaching.enabled") &&
    can(user, rule.modulePermission) &&
    can(user, rule.menuPermission)
  );
}
