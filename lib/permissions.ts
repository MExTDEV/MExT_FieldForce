import type { Country, MockUser, Representative, Role } from "@/lib/types";
import { canAccessRepresentativeData } from "@/lib/data-access";

export const permissionsByRole: Record<Role, string[]> = {
  REPRESENTATIVE: ["self:read", "reflection:write", "help-request:create", "action:self:read", "kpisView"],
  SALES_LEADER: [
    "team:read",
    "history:read",
    "intervention:create",
    "action:create",
    "action:update",
    "actionPointsCreate",
    "actionPointsManage",
    "actionPointsClose",
    "kpisView",
  ],
  SALES_MANAGER: ["country:read", "reporting:read", "intervention:create", "action:create", "action:update", "actionPointsCreate", "actionPointsManage", "kpisView", "kpisCreate", "kpisManage", "kpiTargetsManage"],
  SERVICE_OPERATOR: ["self:read", "service:write"],
  COUNTRY_MANAGER: ["country:read", "reporting:read", "intervention:create", "action:create", "action:update", "actionPointsCreate", "actionPointsManage", "actionPointsClose", "kpisView", "kpisCreate", "kpisManage", "kpiTargetsManage"],
  GROUP_MANAGER: ["group:read", "reporting:read", "intervention:create", "action:create", "action:update", "actionPointsCreate", "actionPointsManage", "actionPointsClose", "kpisView", "kpisCreate", "kpisManage", "kpiTargetsManage"],
  ADMIN: ["scope:configure", "reporting:read", "intervention:create", "action:create", "action:update", "actionPointsCreate", "actionPointsManage", "actionPointsClose", "kpisView", "kpisCreate", "kpisManage", "kpiTargetsManage", "kpiCategoriesManage"],
  SUPER_ADMIN: ["*"],
};

export function can(user: MockUser, permission: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.permissions && permission in user.permissions) {
    return Boolean(user.permissions[permission as keyof typeof user.permissions]);
  }
  const permissions = permissionsByRole[user.role];
  return permissions.includes("*") || permissions.includes(permission);
}

export function canAccessCountry(user: MockUser, country: Country) {
  if (["GROUP_MANAGER", "SUPER_ADMIN"].includes(user.role)) return true;
  if (user.role === "SALES_MANAGER") return (user.countryAccess ?? []).includes(country);
  return user.country === country;
}

export function canAccessRepresentative(user: MockUser, representative: Representative) {
  return canAccessRepresentativeData(user, representative);
}

export function canManageSystem(user: MockUser) {
  return user.role === "SUPER_ADMIN";
}

export function canAccessUserManagement(user: MockUser) {
  return [
    "SALES_LEADER",
    "SALES_MANAGER",
    "COUNTRY_MANAGER",
    "GROUP_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ].includes(user.role);
}

export function canAccessTechnicalManagement(user: MockUser) {
  return ["ADMIN", "SUPER_ADMIN"].includes(user.role);
}

export function canAccessCoaching(user: MockUser) {
  return Boolean(user.id);
}

export function canCreateIntervention(user: MockUser) {
  return user.role === "SUPER_ADMIN" || can(user, "intervention:create");
}

export function canCreateCoachingIntervention(user: MockUser) {
  return canCreateIntervention(user) && can(user, "moduleVisitRecord");
}

export function canAccessSalesday(user: MockUser) {
  return [
    "SALES_LEADER",
    "SALES_MANAGER",
    "COUNTRY_MANAGER",
    "GROUP_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ].includes(user.role);
}

export function canAccessPST(user: MockUser) {
  return canAccessSalesday(user);
}

export function canAccessContract(user: MockUser) {
  return Boolean(user.id);
}

export function canAccessService(user: MockUser) {
  return [
    "SERVICE_OPERATOR",
    "SALES_LEADER",
    "SALES_MANAGER",
    "COUNTRY_MANAGER",
    "GROUP_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ].includes(user.role);
}

export function canViewTeamDashboard(user: MockUser) {
  return [
    "SALES_LEADER",
    "SALES_MANAGER",
    "COUNTRY_MANAGER",
    "GROUP_MANAGER",
    "ADMIN",
    "SUPER_ADMIN",
  ].includes(user.role);
}

export const roleLabels: Record<Role, string> = {
  REPRESENTATIVE: "Vertegenwoordiger",
  SALES_LEADER: "Verkoopleider",
  SALES_MANAGER: "Sales Manager",
  SERVICE_OPERATOR: "Service Operator",
  COUNTRY_MANAGER: "Country Manager",
  GROUP_MANAGER: "Group Manager",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};
