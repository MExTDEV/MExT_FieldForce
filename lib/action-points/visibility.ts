import { can } from "@/lib/permissions";
import type { AppModuleConfig, Country, MockUser, ScopedActionDefinition } from "@/lib/types";

export type ActionPointVisibilityItem = Pick<
  ScopedActionDefinition,
  "scope" | "country" | "teamId" | "userId" | "active"
>;

export type ActionPointSection = {
  id: "open" | "closed";
  title: string;
  emptyMessage: string;
  items: ScopedActionDefinition[];
};

const countryScopedRoles = new Set(["SALES_MANAGER", "COUNTRY_MANAGER", "ADMIN"]);
const globalScopedRoles = new Set(["GROUP_MANAGER", "SUPER_ADMIN"]);

export function canAccessActionPointsOverview(
  user: MockUser,
  modules?: AppModuleConfig[]
) {
  const moduleAllowed = modules
    ? modules.some((module) => module.code === "ACTIEPUNTEN" && module.enabled)
    : true;
  return (
    moduleAllowed &&
    can(user, "modulePreparation") &&
    can(user, "menu.coaching.actionPoints")
  );
}

export function visibleActionPointCountries(user: MockUser): Country[] | undefined {
  if (globalScopedRoles.has(user.role)) return undefined;
  if (countryScopedRoles.has(user.role)) {
    const countries = user.countryAccess?.length ? user.countryAccess : [user.country];
    return [...new Set(countries)];
  }
  return [user.country];
}

export function canViewScopedActionDefinition(
  user: MockUser,
  item: ActionPointVisibilityItem
) {
  if (globalScopedRoles.has(user.role)) return true;
  if (item.scope === "GLOBAL") return true;
  if (matchesUser(user, item.userId)) return true;

  if (user.role === "REPRESENTATIVE") {
    return item.scope === "USER" && matchesUser(user, item.userId);
  }

  if (user.role === "SALES_LEADER") {
    if (item.scope === "COUNTRY") return item.country === user.country;
    if (item.scope === "TEAM") return Boolean(user.teamId && item.teamId === user.teamId);
    if (item.scope === "USER") return Boolean(user.teamId && item.teamId === user.teamId);
    return false;
  }

  const countries = visibleActionPointCountries(user);
  if (countries) {
    return Boolean(item.country && countries.includes(item.country));
  }

  return false;
}

export function splitActionPointSections(
  definitions: ScopedActionDefinition[]
): ActionPointSection[] {
  const open = definitions
    .filter((item) => item.active)
    .sort(compareOpenActionPoints);
  const closed = definitions
    .filter((item) => !item.active)
    .sort(compareClosedActionPoints);

  return [
    {
      id: "open",
      title: "Open",
      emptyMessage: "Er zijn momenteel geen open actiepunten binnen jouw scope.",
      items: open,
    },
    {
      id: "closed",
      title: "Afgesloten",
      emptyMessage: "Er zijn momenteel geen afgesloten actiepunten binnen jouw scope.",
      items: closed,
    },
  ];
}

export function actionPointScopeLabel(scope: ScopedActionDefinition["scope"]) {
  if (scope === "GLOBAL") return "Globaal";
  if (scope === "COUNTRY") return "Land";
  if (scope === "TEAM") return "Team";
  return "Persoonlijk";
}

function compareOpenActionPoints(left: ScopedActionDefinition, right: ScopedActionDefinition) {
  return (
    compareDate(left.validUntil, right.validUntil, "asc", Number.MAX_SAFE_INTEGER) ||
    compareDate(left.validFrom, right.validFrom, "asc", Number.MAX_SAFE_INTEGER) ||
    compareLabel(left.scope, right.scope) ||
    compareLabel(left.id, right.id)
  );
}

function compareClosedActionPoints(left: ScopedActionDefinition, right: ScopedActionDefinition) {
  return (
    compareDate(left.updatedAt, right.updatedAt, "desc", 0) ||
    compareDate(left.validUntil, right.validUntil, "desc", 0) ||
    compareDate(left.validFrom, right.validFrom, "desc", 0) ||
    compareLabel(left.id, right.id)
  );
}

function compareDate(
  left: string | undefined,
  right: string | undefined,
  direction: "asc" | "desc",
  fallback: number
) {
  const leftTime = dateTime(left, fallback);
  const rightTime = dateTime(right, fallback);
  return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
}

function dateTime(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
}

function compareLabel(left: string, right: string) {
  return left.localeCompare(right, "nl-BE");
}

function matchesUser(user: MockUser, userId?: string | null) {
  return Boolean(userId && [user.id, user.representativeId].filter(Boolean).includes(userId));
}
