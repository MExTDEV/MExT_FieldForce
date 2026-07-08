import { can } from "@/lib/permissions";
import type {
  AppModuleConfig,
  Country,
  ManagedUser,
  MockUser,
  Representative,
  ScopedActionDefinition,
  WorkflowActionPoint,
} from "@/lib/types";

export type ActionPointVisibilityItem = Pick<
  ScopedActionDefinition,
  "scope" | "country" | "teamId" | "userId" | "active"
>;

export type ActionPointOverviewSource = "definition" | "workflow";

export type ActionPointOverviewItem = ScopedActionDefinition & {
  source?: ActionPointOverviewSource;
  status?: WorkflowActionPoint["status"];
  due?: string;
  ownerName?: string;
  representativeId?: string;
  representativeName?: string;
  originLabel?: string;
};

export type ActionPointScopeGroup = {
  id: ScopedActionDefinition["scope"];
  title: string;
  items: ActionPointOverviewItem[];
};

export type ActionPointUserGroup = {
  id: string;
  title: string;
  subtitle: string;
  items: ActionPointOverviewItem[];
};

export type ActionPointSection = {
  id: "open" | "closed";
  title: string;
  emptyMessage: string;
  items: ActionPointOverviewItem[];
  groups: ActionPointScopeGroup[];
};

const countryScopedRoles = new Set(["SALES_MANAGER", "COUNTRY_MANAGER", "ADMIN"]);
const globalScopedRoles = new Set(["GROUP_MANAGER", "SUPER_ADMIN"]);
const closedActionStatuses = new Set<WorkflowActionPoint["status"]>([
  "afgerond",
  "behaald",
  "niet_behaald",
  "geannuleerd",
]);
const scopeOrder: ScopedActionDefinition["scope"][] = ["GLOBAL", "COUNTRY", "TEAM", "USER"];

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

export function canViewActionPointUserTab(user: MockUser) {
  return user.role !== "REPRESENTATIVE";
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
  definitions: ActionPointOverviewItem[]
): ActionPointSection[] {
  const open = definitions
    .filter(isOpenActionPoint)
    .sort(compareOpenActionPoints);
  const closed = definitions
    .filter((item) => !isOpenActionPoint(item))
    .sort(compareClosedActionPoints);

  return [
    {
      id: "open",
      title: "Open",
      emptyMessage: "Er zijn momenteel geen open actiepunten binnen jouw scope.",
      items: open,
      groups: groupActionPointsByScope(open),
    },
    {
      id: "closed",
      title: "Afgesloten",
      emptyMessage: "Er zijn momenteel geen afgesloten actiepunten binnen jouw scope.",
      items: closed,
      groups: groupActionPointsByScope(closed),
    },
  ];
}

export function groupActionPointsByScope(items: ActionPointOverviewItem[]): ActionPointScopeGroup[] {
  return scopeOrder.flatMap((scope) => {
    const scopeItems = items.filter((item) => item.scope === scope);
    return scopeItems.length ? [{ id: scope, title: actionPointScopeLabel(scope), items: scopeItems }] : [];
  });
}

export function groupActionPointsByRepresentative(
  items: ActionPointOverviewItem[],
  representatives: Representative[],
  users: ManagedUser[] = []
): ActionPointUserGroup[] {
  return [...representatives]
    .sort((left, right) =>
      compareLabel(left.country, right.country) ||
      compareLabel(left.team, right.team) ||
      compareLabel(left.lastName, right.lastName) ||
      compareLabel(left.firstName, right.firstName)
    )
    .flatMap((representative) => {
      const representativeItems = items.filter((item) =>
        actionPointAppliesToRepresentative(item, representative, users)
      );
      return representativeItems.length
        ? [{
          id: representative.id,
          title: `${representative.firstName} ${representative.lastName}`,
          subtitle: `${representative.team} · ${representative.country}`,
          items: representativeItems,
        }]
        : [];
    });
}

export function actionPointAppliesToRepresentative(
  item: ActionPointOverviewItem,
  representative: Representative,
  users: ManagedUser[] = []
) {
  if (item.scope === "GLOBAL") return true;
  if (item.scope === "COUNTRY") return item.country === representative.country;
  if (item.scope === "TEAM") return item.teamId === representative.teamId;
  if (item.representativeId === representative.id) return true;
  if (item.userId === representative.id) return true;
  return users.some((user) =>
    user.representativeId === representative.id &&
    (user.id === item.userId || user.representativeId === item.userId)
  );
}

export function isOpenActionPoint(item: ActionPointOverviewItem) {
  return item.status ? !closedActionStatuses.has(item.status) : item.active;
}

export function actionPointScopeLabel(scope: ScopedActionDefinition["scope"]) {
  if (scope === "GLOBAL") return "Globaal";
  if (scope === "COUNTRY") return "Land";
  if (scope === "TEAM") return "Team";
  return "Persoonlijk";
}

function compareOpenActionPoints(left: ActionPointOverviewItem, right: ActionPointOverviewItem) {
  return (
    compareDate(left.due ?? left.validUntil, right.due ?? right.validUntil, "asc", Number.MAX_SAFE_INTEGER) ||
    compareDate(left.validFrom, right.validFrom, "asc", Number.MAX_SAFE_INTEGER) ||
    compareLabel(left.scope, right.scope) ||
    compareLabel(left.id, right.id)
  );
}

function compareClosedActionPoints(left: ActionPointOverviewItem, right: ActionPointOverviewItem) {
  return (
    compareDate(left.updatedAt, right.updatedAt, "desc", 0) ||
    compareDate(left.due ?? left.validUntil, right.due ?? right.validUntil, "desc", 0) ||
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
