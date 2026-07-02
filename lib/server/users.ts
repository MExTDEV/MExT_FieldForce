import { prisma } from "@/lib/server/db";
import {
  fieldForcePermissionKeys,
  normalizeManagedUser,
  prepareManagedUserSave,
  roleTemplates,
} from "@/lib/user-management";
import type {
  Country,
  FieldForcePermissionKey,
  Language,
  ManagedUser,
  MockUser,
  Role,
} from "@/lib/types";

type UserWithAccess = Awaited<ReturnType<typeof fetchUsersWithAccess>>[number];

export async function listManagedUsers() {
  const [users, rolePermissions] = await Promise.all([
    fetchUsersWithAccess(),
    fetchRolePermissions(),
  ]);
  return users.map((user) => toManagedUser(user, rolePermissions));
}

export async function createManagedUserInDatabase(
  actorId: string,
  draft: ManagedUser,
  newTeamName?: string
) {
  const users = await listManagedUsers();
  const actor = actorFromManagedUser(users.find((user) => user.id === actorId));
  if (!actor) throw new Error("Actieve gebruiker niet gevonden.");

  const prepared = prepareManagedUserSave(actor, users, draft);
  if (newTeamName?.trim()) {
    return createSalesLeaderWithTeam(prepared, newTeamName.trim());
  }
  await validateManagedUserTeam(prepared);
  const created = await prisma.user.create({
    data: userDataFromManagedUser(prepared),
  });
  await replaceUserPermissions(created.id, prepared.permissions);
  return toManagedUser(
    await fetchUserWithAccess(created.id),
    await fetchRolePermissions()
  );
}

async function createSalesLeaderWithTeam(
  prepared: ManagedUser,
  teamName: string
) {
  if (prepared.role !== "SALES_LEADER" && !prepared.teamSupervisor) {
    throw new Error(
      "De nieuwe gebruiker moet verkoopleider of teamsupervisor zijn om primaire leider van een nieuw team te worden."
    );
  }

  const permissionRecords = await prisma.permission.findMany();
  const createdId = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        ...userDataFromManagedUser(prepared),
        teamId: null,
      },
    });
    const team = await tx.team.create({
      data: {
        name: teamName,
        country: prepared.country,
        primaryLeaderId: created.id,
        active: true,
      },
    });
    await tx.teamLeader.create({
      data: {
        teamId: team.id,
        userId: created.id,
        type: "PRIMARY",
      },
    });
    await tx.user.update({
      where: { id: created.id },
      data: { teamId: team.id },
    });
    await Promise.all(
      permissionRecords.map((permission) =>
        tx.userPermission.upsert({
          where: {
            userId_permissionId: {
              userId: created.id,
              permissionId: permission.id,
            },
          },
          update: {
            enabled: Boolean(
              prepared.permissions[permission.key as FieldForcePermissionKey]
            ),
          },
          create: {
            userId: created.id,
            permissionId: permission.id,
            enabled: Boolean(
              prepared.permissions[permission.key as FieldForcePermissionKey]
            ),
          },
        })
      )
    );
    return created.id;
  });

  return toManagedUser(
    await fetchUserWithAccess(createdId),
    await fetchRolePermissions()
  );
}

export async function updateManagedUserInDatabase(
  actorId: string,
  userId: string,
  draft: ManagedUser
) {
  const users = await listManagedUsers();
  const actor = actorFromManagedUser(users.find((user) => user.id === actorId));
  if (!actor) throw new Error("Actieve gebruiker niet gevonden.");
  const existing = users.find((user) => user.id === userId);
  if (!existing) throw new Error("Gebruiker niet gevonden.");

  const prepared = prepareManagedUserSave(actor, users, draft, existing);
  await validateManagedUserTeam(prepared);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: userDataFromManagedUser(prepared),
  });
  await replaceUserPermissions(updated.id, prepared.permissions);
  return toManagedUser(
    await fetchUserWithAccess(updated.id),
    await fetchRolePermissions()
  );
}

async function fetchRolePermissions() {
  return prisma.rolePermission.findMany({
    include: { permission: true },
  });
}

async function fetchUsersWithAccess() {
  return prisma.user.findMany({
    include: {
      team: true,
      permissions: { include: { permission: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

async function fetchUserWithAccess(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      team: true,
      permissions: { include: { permission: true } },
    },
  });
}

function toManagedUser(
  user: UserWithAccess,
  rolePermissions: Awaited<ReturnType<typeof fetchRolePermissions>>
): ManagedUser {
  const role = user.role as Role;
  const basePermissions = { ...roleTemplates[role].permissions };
  for (const grant of rolePermissions.filter((item) => item.role === role)) {
    basePermissions[grant.permission.key as FieldForcePermissionKey] =
      grant.enabled;
  }
  for (const grant of user.permissions) {
    basePermissions[grant.permission.key as FieldForcePermissionKey] =
      grant.enabled;
  }

  return normalizeManagedUser({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile ?? "",
    language: user.language as Language,
    country: user.country as Country,
    teamId: user.teamId ?? "",
    teamName: user.team?.name ?? "",
    role,
    teamSupervisor: user.teamSupervisor,
    branchNumber: user.branchNumber ?? "",
    active: user.active,
    avatarUrl: user.avatarUrl ?? "",
    permissions: fieldForcePermissionKeys.reduce(
      (result, key) => ({ ...result, [key]: Boolean(basePermissions[key]) }),
      {} as Record<FieldForcePermissionKey, boolean>
    ),
    representativeId: user.representativeId ?? undefined,
    microsoftLinked: Boolean(user.entraId),
    entraId: user.entraId ?? undefined,
    microsoftEmail: user.microsoftEmail ?? undefined,
    lastLoginAt: user.lastLoginAt?.toISOString(),
  });
}

function actorFromManagedUser(user?: ManagedUser): MockUser | undefined {
  if (!user || !user.active) return undefined;
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    country: user.country,
    language: user.language,
    teamId: user.teamId || undefined,
    representativeId: user.representativeId,
  };
}

function userDataFromManagedUser(user: ManagedUser) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile || null,
    avatarUrl: user.avatarUrl || null,
    branchNumber: user.branchNumber || null,
    representativeId: user.representativeId ?? null,
    role: user.role,
    country: user.country,
    language: user.language,
    active: user.active,
    teamSupervisor: user.teamSupervisor,
    teamId: user.teamId || null,
  };
}

async function validateManagedUserTeam(user: ManagedUser) {
  const teamRequired = ["REPRESENTATIVE", "SALES_LEADER", "SERVICE_OPERATOR"].includes(
    user.role
  );
  if (!user.teamId) {
    if (teamRequired) throw new Error("Selecteer een team voor deze rol.");
    return;
  }

  const team = await prisma.team.findFirst({
    where: {
      id: user.teamId,
      country: user.country,
      active: true,
    },
    select: { id: true },
  });
  if (!team) {
    throw new Error(
      "Het gekozen team is niet actief of behoort niet tot het geselecteerde land."
    );
  }
}

async function replaceUserPermissions(
  userId: string,
  permissions: Record<FieldForcePermissionKey, boolean>
) {
  const permissionRecords = await prisma.permission.findMany();
  await prisma.$transaction(
    permissionRecords.map((permission) =>
      prisma.userPermission.upsert({
        where: {
          userId_permissionId: {
            userId,
            permissionId: permission.id,
          },
        },
        update: {
          enabled: Boolean(permissions[permission.key as FieldForcePermissionKey]),
        },
        create: {
          userId,
          permissionId: permission.id,
          enabled: Boolean(permissions[permission.key as FieldForcePermissionKey]),
        },
      })
    )
  );
}
