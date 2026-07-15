import { can } from "@/lib/permissions";
import type { FieldForcePermissionKey, MockUser } from "@/lib/types";

export type ManagementSection =
  | "gebruikers"
  | "teams"
  | "rollen"
  | "kpis"
  | "starterEvaluations"
  | "kapstok"
  | "modules"
  | "mail"
  | "profiel"
  | "log";

export type ManagementSectionDefinition = {
  section: ManagementSection;
  href: string;
  navKey: string;
  permission: FieldForcePermissionKey;
  requiredPermissions?: FieldForcePermissionKey[];
};

export const managementSections: ManagementSectionDefinition[] = [
  {
    section: "gebruikers",
    href: "/beheer/gebruikers",
    navKey: "nav.users",
    permission: "menu.coaching.users",
    requiredPermissions: ["usersView"],
  },
  {
    section: "teams",
    href: "/beheer/teams",
    navKey: "nav.teams",
    permission: "menu.coaching.teams",
  },
  {
    section: "rollen",
    href: "/beheer/rollen",
    navKey: "nav.roles",
    permission: "menu.coaching.roles",
  },
  {
    section: "kpis",
    href: "/beheer/kpis",
    navKey: "nav.kpis",
    permission: "menu.coaching.kpis",
    requiredPermissions: ["kpisView"],
  },
  {
    section: "starterEvaluations",
    href: "/beheer/starterEvaluations",
    navKey: "nav.starterEvaluationQuestions",
    permission: "menu.coaching.starterEvaluations",
    requiredPermissions: ["starterEvaluationsManage"],
  },
  {
    section: "kapstok",
    href: "/beheer/kapstok",
    navKey: "nav.framework",
    permission: "menu.coaching.framework",
  },
  {
    section: "modules",
    href: "/beheer/modules",
    navKey: "nav.modules",
    permission: "menu.coaching.modules",
  },
  {
    section: "mail",
    href: "/beheer/instellingen/mail",
    navKey: "nav.mail",
    permission: "menu.coaching.settings",
  },
  {
    section: "profiel",
    href: "/beheer/instellingen/profiel",
    navKey: "nav.profile",
    permission: "menu.coaching.settings",
  },
  {
    section: "log",
    href: "/beheer/log",
    navKey: "nav.log",
    permission: "menu.coaching.log",
  },
];

export function getManagementSection(section: string) {
  return managementSections.find((item) => item.section === section);
}

export function canAccessManagementSection(
  user: MockUser,
  section: string
) {
  const definition = getManagementSection(section);
  if (
    !definition ||
    !can(user, "menu.coaching.enabled") ||
    !can(user, definition.permission)
  ) {
    return false;
  }
  return (definition.requiredPermissions ?? []).every((permission) =>
    can(user, permission)
  );
}

export function getVisibleManagementSections(user: MockUser) {
  return managementSections.filter((section) =>
    canAccessManagementSection(user, section.section)
  );
}

export function getDefaultManagementSection(user: MockUser) {
  return getVisibleManagementSections(user)[0]?.section;
}
