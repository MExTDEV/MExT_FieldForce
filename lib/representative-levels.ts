import type { ManagedUser, MockUser, RepresentativeLevel, Role } from "@/lib/types";

export const representativeLevels = [
  "STARTER",
  "SALES_EXECUTIVE",
  "PROFESSIONAL",
  "EXPERT",
] as const satisfies readonly RepresentativeLevel[];

export const representativeLevelLabels: Record<RepresentativeLevel, string> = {
  STARTER: "Starter",
  SALES_EXECUTIVE: "Sales Executive",
  PROFESSIONAL: "Professional",
  EXPERT: "Expert",
};

export const representativeLevelBadgeClass: Record<RepresentativeLevel, string> = {
  STARTER: "bg-slate-100 text-slate-700",
  SALES_EXECUTIVE: "bg-brand-100 text-brand-800",
  PROFESSIONAL: "bg-emerald-100 text-emerald-800",
  EXPERT: "bg-purple-100 text-purple-800",
};

const representativeLevelManagerRoles = new Set<Role>([
  "GROUP_MANAGER",
  "SALES_MANAGER",
  "COUNTRY_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export function isRepresentativeLevel(value: unknown): value is RepresentativeLevel {
  return typeof value === "string" && representativeLevels.includes(value as RepresentativeLevel);
}

export function normalizeRepresentativeLevel(value: unknown, fallback: RepresentativeLevel): RepresentativeLevel {
  return isRepresentativeLevel(value) ? value : fallback;
}

export function defaultRepresentativeLevelForNewUser(role: Role): RepresentativeLevel {
  return role === "REPRESENTATIVE" ? "STARTER" : "STARTER";
}

export function defaultRepresentativeLevelForRoleReturn(role: Role, existing?: ManagedUser): RepresentativeLevel {
  if (role !== "REPRESENTATIVE") return existing?.representativeLevel ?? "STARTER";
  if (existing && existing.role !== "REPRESENTATIVE") return "SALES_EXECUTIVE";
  return existing?.representativeLevel ?? "STARTER";
}

export function canManageRepresentativeLevel(actor: MockUser, target?: Pick<ManagedUser, "country" | "countryAccess">) {
  if (!representativeLevelManagerRoles.has(actor.role)) return false;
  if (["SUPER_ADMIN", "GROUP_MANAGER"].includes(actor.role)) return true;
  if (!target) return true;
  if (actor.role === "SALES_MANAGER") {
    return (actor.countryAccess ?? []).includes(target.country);
  }
  return actor.country === target.country;
}

export function isPeerCoachingRepresentativeLevel(level: RepresentativeLevel | null | undefined) {
  return level === "PROFESSIONAL" || level === "EXPERT";
}

export function representativeLevelLabel(level: RepresentativeLevel | null | undefined) {
  return representativeLevelLabels[level ?? "STARTER"];
}
