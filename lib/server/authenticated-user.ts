import { auth, authMode } from "@/auth";
import { unauthorized } from "@/lib/server/api";
import { forbidden } from "@/lib/server/api";
import { prisma } from "@/lib/server/db";
import { can } from "@/lib/permissions";
import type { MockUser, Role } from "@/lib/types";

export async function requireAuthenticatedUser(
  requestedActorId?: string | null
): Promise<MockUser> {
  if (authMode === "demo") {
    if (!requestedActorId) unauthorized("Geen actieve demogebruiker ontvangen.");
    const demoUser = await findActiveUser(requestedActorId);
    if (!demoUser) unauthorized("Actieve demogebruiker niet gevonden.");
    return demoUser;
  }

  const session = await auth();
  const databaseUserId = session?.user?.databaseUserId;
  if (!databaseUserId) unauthorized();
  const user = await findActiveUser(databaseUserId);
  if (!user) unauthorized("De aangemelde gebruiker is niet actief in FieldForce.");
  return user;
}

export async function requireAuthenticatedRead() {
  if (authMode === "demo") return undefined;
  return requireAuthenticatedUser();
}

export function requireRole(user: MockUser, roles: Role[]) {
  if (!roles.includes(user.role)) forbidden();
}

export function requirePermission(user: MockUser, permission: string) {
  if (!can(user, permission)) forbidden();
}

export async function requireRepresentativeScope(
  user: MockUser,
  representativeIds: string[]
) {
  const uniqueIds = [...new Set(representativeIds.filter(Boolean))];
  if (!uniqueIds.length || ["GROUP_MANAGER", "SUPER_ADMIN"].includes(user.role)) return;
  const representatives = await prisma.user.findMany({
    where: {
      role: "REPRESENTATIVE",
      OR: [{ id: { in: uniqueIds } }, { representativeId: { in: uniqueIds } }],
    },
    select: {
      id: true,
      representativeId: true,
      country: true,
      teamId: true,
    },
  });
  if (representatives.length !== uniqueIds.length) forbidden("Vertegenwoordigersscope is ongeldig.");
  const allowed = representatives.every((representative) => {
    if (user.role === "REPRESENTATIVE") {
      return [representative.id, representative.representativeId].includes(user.representativeId ?? user.id);
    }
    if (user.role === "SALES_LEADER") return representative.teamId === user.teamId;
    return representative.country === user.country;
  });
  if (!allowed) forbidden("Deze vertegenwoordiger valt buiten je toegestane scope.");
}

export async function requireCoachingParticipantScope(
  actor: MockUser,
  participantIds: string[]
) {
  const uniqueIds = [...new Set(participantIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  const participants = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: ["REPRESENTATIVE", "SALES_LEADER"] },
      OR: [{ id: { in: uniqueIds } }, { representativeId: { in: uniqueIds } }],
    },
    select: { id: true, representativeId: true, role: true, country: true, teamId: true },
  });
  if (participants.length !== uniqueIds.length) forbidden("De geselecteerde begeleide persoon is ongeldig.");
  const allowed = participants.every((participant) => {
    if (participant.id === actor.id) return false;
    if (actor.role === "SALES_LEADER") {
      return participant.role === "REPRESENTATIVE" && Boolean(actor.teamId && participant.teamId === actor.teamId);
    }
    if (["COUNTRY_MANAGER", "ADMIN"].includes(actor.role)) return participant.country === actor.country;
    return ["GROUP_MANAGER", "SUPER_ADMIN"].includes(actor.role);
  });
  if (!allowed) forbidden("Deze persoon valt buiten je toegestane begeleidingsscope.");
}

export async function requireCoachingOwnerScope(actor: MockUser, ownerIds: string[]) {
  const ids = [...new Set(ownerIds.filter(Boolean))];
  if (!ids.length) return;
  const owners = await prisma.user.findMany({
    where: { id: { in: ids }, active: true, role: { in: ["SALES_LEADER", "COUNTRY_MANAGER", "GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, country: true },
  });
  if (owners.length !== ids.length) forbidden("De geselecteerde begeleider is ongeldig.");
  const allowed = owners.every((owner) => {
    if (actor.role === "SALES_LEADER") return owner.id === actor.id;
    if (["COUNTRY_MANAGER", "ADMIN"].includes(actor.role)) return owner.country === actor.country;
    return ["GROUP_MANAGER", "SUPER_ADMIN"].includes(actor.role);
  });
  if (!allowed) forbidden("De begeleider valt buiten je toegestane scope.");
}

async function findActiveUser(id: string): Promise<MockUser | undefined> {
  const user = await prisma.user.findFirst({
    where: {
      active: true,
      OR: [{ id }, { representativeId: id }],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      country: true,
      language: true,
      teamId: true,
      representativeId: true,
    },
  });
  if (!user) return undefined;
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    role: user.role,
    country: user.country,
    language: user.language,
    teamId: user.teamId ?? undefined,
    representativeId: user.representativeId ?? undefined,
  };
}
