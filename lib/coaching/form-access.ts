import type { Role } from "@/lib/types";

export function canRoleEditCoachingForm(role: Role) {
  return role !== "REPRESENTATIVE";
}
