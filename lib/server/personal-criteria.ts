import { prisma } from "@/lib/server/db";
import type { Country, PersonalCoachingCriterion } from "@/lib/types";

export async function listPersonalCriteriaFromDatabase(): Promise<PersonalCoachingCriterion[]> {
  const criteria = await prisma.personalCoachingCriterion.findMany({
    include: { representative: true },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
  });
  return criteria.map(toPersonalCriterion);
}

export async function getPersonalCriterionFromDatabase(id: string) {
  const criterion = await prisma.personalCoachingCriterion.findUnique({
    where: { id },
    include: { representative: true },
  });
  return criterion ? toPersonalCriterion(criterion) : undefined;
}

export async function createPersonalCriterionInDatabase(input: PersonalCoachingCriterion) {
  const created = await prisma.personalCoachingCriterion.create({
    include: { representative: true },
    data: {
      id: input.id,
      title: input.title,
      description: input.description,
      focusName: input.focusName,
      representativeId: await representativeUserId(input.representativeId),
      createdByUserId: input.createdByUserId,
      teamId: input.teamId,
      country: input.country,
      active: input.isActive,
    },
  });
  return toPersonalCriterion(created);
}

export async function updatePersonalCriterionInDatabase(
  id: string,
  input: Pick<PersonalCoachingCriterion, "title" | "description" | "focusName">
) {
  const updated = await prisma.personalCoachingCriterion.update({
    include: { representative: true },
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      focusName: input.focusName,
    },
  });
  return toPersonalCriterion(updated);
}

export async function deactivatePersonalCriterionInDatabase(id: string) {
  await prisma.personalCoachingCriterion.update({
    where: { id },
    data: { active: false },
  });
}

function toPersonalCriterion(item: {
  id: string;
  title: string;
  description: string;
  focusName: string;
  representativeId: string;
  representative?: { id: string; representativeId: string | null };
  createdByUserId: string;
  teamId: string;
  country: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PersonalCoachingCriterion {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    focusName: item.focusName,
    representativeId: item.representative?.representativeId ?? item.representativeId,
    createdByUserId: item.createdByUserId,
    teamId: item.teamId,
    country: item.country as Country,
    isActive: item.active,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function representativeUserId(representativeId: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: representativeId }, { representativeId }] },
    select: { id: true },
  });
  if (!user) throw new Error("Vertegenwoordiger niet gevonden.");
  return user.id;
}
