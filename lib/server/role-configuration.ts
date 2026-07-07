import { roleLabels } from "@/lib/permissions";
import { prisma } from "@/lib/server/db";
import type { Role } from "@/lib/types";

export const applicationRoles = Object.keys(roleLabels) as Role[];

export async function listRoleConfigurations() {
  const stored = await prisma.roleConfiguration.findMany();
  const activeByRole = new Map(
    stored.map((configuration) => [
      configuration.role as Role,
      configuration.active,
    ])
  );
  return applicationRoles.map((role) => ({
    role,
    active: activeByRole.get(role) ?? true,
  }));
}

export async function isRoleActive(role: Role) {
  const configuration = await prisma.roleConfiguration.findUnique({
    where: { role },
    select: { active: true },
  });
  return configuration?.active ?? true;
}

export async function assertRoleAssignable(role: Role, existingRole?: Role) {
  if (existingRole === role) return;
  if (await isRoleActive(role)) return;
  throw new Error(
    `De rol ${roleLabels[role]} is inactief en kan niet worden toegewezen.`
  );
}
