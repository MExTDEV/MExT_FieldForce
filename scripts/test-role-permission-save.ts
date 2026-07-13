import { getManagementConfiguration, saveRolePermissions } from "../lib/server/management";
import { prisma } from "../lib/server/db";
import { fieldForcePermissionKeys } from "../lib/user-management";
import type { MockUser } from "../lib/types";

const actor: MockUser = {
  id: "codex-role-save-test",
  name: "Codex",
  email: "codex@example.test",
  role: "SUPER_ADMIN",
  country: "BE",
  language: "nl",
  permissions: {},
};

async function main() {
  const config = await getManagementConfiguration(actor, "rollen");
  const salesManagerRole = config.roles.find((role) => role.role === "SALES_MANAGER");

  if (!salesManagerRole) {
    throw new Error("SALES_MANAGER role config ontbreekt.");
  }

  const result = await saveRolePermissions(
    actor,
    "SALES_MANAGER",
    salesManagerRole.permissions,
    salesManagerRole.active
  );

  const permissionRecords = await prisma.permission.findMany({
    where: { key: { in: fieldForcePermissionKeys } },
    select: { key: true },
  });
  const presentPermissionKeys = new Set(permissionRecords.map((permission) => permission.key));
  const missingPermissionKeys = fieldForcePermissionKeys.filter(
    (key) => !presentPermissionKeys.has(key)
  );

  if (missingPermissionKeys.length) {
    throw new Error(
      `Permission-basisrecords ontbreken: ${missingPermissionKeys.join(", ")}.`
    );
  }

  console.log(
    JSON.stringify({
      role: result.role,
      changedPermissions: result.changedPermissions.length,
      missingPermissionRecords: missingPermissionKeys.length,
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
