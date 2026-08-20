import { prisma } from "@/lib/server/db";
import { assertRoleAssignable } from "@/lib/server/role-configuration";
import {
  normalizeManagedUser,
  prepareManagedUserSave,
} from "@/lib/user-management";
import {
  applyPermissionOverrides,
  listPermissionOverrides,
  missingPermissionKeys,
  resolveRolePermissions,
} from "@/lib/role-permissions";
import type {
  Country,
  Language,
  ManagedUser,
  MockUser,
  Role,
} from "@/lib/types";
import { normalizeRepresentativeLevel } from "@/lib/representative-levels";
import type { Prisma } from "@prisma/client";

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
  await assertRoleAssignable(prepared.role);
  if (newTeamName?.trim()) {
    return createSalesLeaderWithTeam(prepared, newTeamName.trim(), actor.id);
  }
  await validateManagedUserTeam(prepared);
  const permissionOverrides = await preparePermissionOverrides(
    prepared.permissions,
    prepared.role
  );
  const createdId = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: userDataFromManagedUser(prepared),
    });
    await recordRepresentativeLevelHistoryInTransaction(
      tx,
      created.id,
      null,
      created.representativeLevel,
      actor.id,
      "user.created"
    );
    await replaceUserCountryAccessInTransaction(
      tx,
      created.id,
      prepared.countryAccess
    );
    await replaceUserPermissionsInTransaction(
      tx,
      created.id,
      permissionOverrides
    );
    return created.id;
  });
  return toManagedUser(
    await fetchUserWithAccess(createdId),
    await fetchRolePermissions()
  );
}

async function createSalesLeaderWithTeam(
  prepared: ManagedUser,
  teamName: string,
  actorId: string
) {
  if (prepared.role !== "SALES_LEADER" && !prepared.teamSupervisor) {
    throw new Error(
      "De nieuwe gebruiker moet verkoopleider of teamsupervisor zijn om primaire leider van een nieuw team te worden."
    );
  }

  const permissionOverrides = await preparePermissionOverrides(
    prepared.permissions,
    prepared.role
  );
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
    await recordRepresentativeLevelHistoryInTransaction(
      tx,
      created.id,
      null,
      created.representativeLevel,
      actorId,
      "user.created"
    );
    await replaceUserCountryAccessInTransaction(tx, created.id, prepared.countryAccess);
    await replaceUserPermissionsInTransaction(
      tx,
      created.id,
      permissionOverrides
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
  await assertRoleAssignable(prepared.role, existing.role);
  await validateManagedUserTeam(prepared);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: userDataFromManagedUser(prepared),
  });
  if (existing.representativeLevel !== prepared.representativeLevel) {
    await recordRepresentativeLevelHistory(
      updated.id,
      existing.representativeLevel,
      updated.representativeLevel,
      actor.id,
      "user.updated"
    );
  }
  await replaceUserCountryAccess(updated.id, prepared.countryAccess);
  await replaceUserPermissions(updated.id, prepared.permissions, prepared.role);
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
      team: { select: { id: true, name: true, country: true, active: true } },
      countryAccess: true,
      permissions: { include: { permission: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

async function fetchUserWithAccess(id: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      team: { select: { id: true, name: true, country: true, active: true } },
      countryAccess: true,
      permissions: { include: { permission: true } },
    },
  });
}

function toManagedUser(
  user: UserWithAccess,
  rolePermissions: Awaited<ReturnType<typeof fetchRolePermissions>>
): ManagedUser {
  const role = user.role as Role;
  const roleDefaults = resolveRolePermissions(role, rolePermissions);
  const effectivePermissions = applyPermissionOverrides(roleDefaults, user.permissions);

  return normalizeManagedUser({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile ?? "",
    language: user.language as Language,
    country: user.country as Country,
    countryAccess: user.countryAccess.map((scope) => scope.country as Country),
    teamId: user.teamId ?? "",
    teamName: user.team?.name ?? "",
    role,
    representativeLevel: normalizeRepresentativeLevel(user.representativeLevel, "STARTER"),
    starterStartDate: user.starterStartDate?.toISOString().slice(0, 10),
    teamSupervisor: user.teamSupervisor,
    branchNumber: user.branchNumber ?? "",
    active: user.active,
    avatarUrl: user.avatarUrl ?? "",
    profilePhotoSyncStatus: user.profilePhotoSyncStatus ?? undefined,
    profilePhotoSyncedAt: user.profilePhotoSyncedAt?.toISOString(),
    profilePhotoSyncError: user.profilePhotoSyncError ?? undefined,
    permissions: effectivePermissions,
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
    countryAccess: user.countryAccess,
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
    representativeLevel: user.representativeLevel,
    starterStartDate: user.starterStartDate ? new Date(`${user.starterStartDate}T00:00:00.000Z`) : null,
    country: user.country,
    language: user.language,
    active: user.active,
    teamSupervisor: user.teamSupervisor,
    teamId: user.teamId || null,
  };
}

async function recordRepresentativeLevelHistory(
  userId: string,
  oldValue: ManagedUser["representativeLevel"] | null,
  newValue: ManagedUser["representativeLevel"],
  changedById: string,
  reason: string
) {
  await prisma.representativeLevelHistory.create({
    data: {
      userId,
      oldValue,
      newValue,
      changedById,
      reason,
    },
  });
}

async function recordRepresentativeLevelHistoryInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  oldValue: ManagedUser["representativeLevel"] | null,
  newValue: ManagedUser["representativeLevel"],
  changedById: string,
  reason: string
) {
  await tx.representativeLevelHistory.create({
    data: {
      userId,
      oldValue,
      newValue,
      changedById,
      reason,
    },
  });
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
  permissions: ManagedUser["permissions"],
  role: Role
) {
  const overrides = await preparePermissionOverrides(permissions, role);

  await prisma.$transaction(async (tx) => {
    await replaceUserPermissionsInTransaction(tx, userId, overrides);
  });
}

async function preparePermissionOverrides(
  permissions: ManagedUser["permissions"],
  role: Role
) {
  const [permissionRecords, rolePermissions] = await Promise.all([
    prisma.permission.findMany(),
    fetchRolePermissions(),
  ]);
  const missing = missingPermissionKeys(permissionRecords.map(({ key }) => key));
  if (missing.length) throw new Error(`Ontbrekende rechten in de database: ${missing.join(", ")}.`);
  const defaults = resolveRolePermissions(role, rolePermissions);
  const overrides = listPermissionOverrides(permissions, defaults);
  const permissionByKey = new Map(
    permissionRecords.map((permission) => [permission.key, permission])
  );
  return [...new Map(overrides.map(({ key, enabled }) => [
    permissionByKey.get(key)!.id,
    { permissionId: permissionByKey.get(key)!.id, enabled },
  ])).values()];
}

async function replaceUserPermissionsInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  overrides: Array<{ permissionId: string; enabled: boolean }>
) {
  await tx.userPermission.deleteMany({ where: { userId } });
  if (overrides.length) {
    await tx.userPermission.createMany({
      data: overrides.map(({ permissionId, enabled }) => ({
        userId,
        permissionId,
        enabled,
      })),
    });
  }
}

async function replaceUserCountryAccess(userId: string, countries: Country[]) {
  await prisma.$transaction(async (tx) => {
    await replaceUserCountryAccessInTransaction(tx, userId, countries);
  });
}

async function replaceUserCountryAccessInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  countries: Country[]
) {
  await tx.userCountryAccess.deleteMany({ where: { userId } });
  const uniqueCountries = [...new Set(countries)];
  if (uniqueCountries.length) {
    await tx.userCountryAccess.createMany({
      data: uniqueCountries.map((country) => ({ userId, country })),
    });
  }
}
