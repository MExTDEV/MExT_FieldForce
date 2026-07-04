import { prisma } from "@/lib/server/db";
import { resolveKpiTargetFromDefinition } from "@/lib/server/kpi-targets";
import type { Country, Representative } from "@/lib/types";

const levelColors: Record<string, string> = {
  Starter: "bg-amber-100 text-amber-800",
  Vertegenwoordiger: "bg-sky-100 text-sky-800",
  Professional: "bg-indigo-100 text-indigo-800",
  Expert: "bg-emerald-100 text-emerald-800",
};

type RepresentativeUser = Awaited<ReturnType<typeof fetchRepresentativeUsers>>[number];

export async function listRepresentativesFromDatabase(): Promise<Representative[]> {
  const users = await fetchRepresentativeUsers();
  const actionCounts = await openActionCounts();
  const lastCoachings = await latestCoachings();
  return users.map((user) =>
    toRepresentative(
      user,
      actionCounts.get(user.id) ?? 0,
      lastCoachings.get(user.id)
    )
  );
}

async function fetchRepresentativeUsers() {
  return prisma.user.findMany({
    where: {
      role: "REPRESENTATIVE",
      active: true,
    },
    include: {
      team: true,
      level: true,
      kpiSnapshots: {
        include: { kpiDefinition: { include: { targetOverrides: true } } },
        orderBy: [{ periodEnd: "desc" }, { kpiDefinition: { name: "asc" } }],
      },
    },
    orderBy: [{ country: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
}

async function openActionCounts() {
  const grouped = await prisma.actionPoint.groupBy({
    by: ["representativeId"],
    where: {
      status: { in: ["NIEUW", "IN_UITVOERING"] },
    },
    _count: { id: true },
  });
  return new Map(grouped.map((item) => [item.representativeId, item._count.id]));
}

async function latestCoachings() {
  const interventions = await prisma.intervention.findMany({
    where: {
      type: "BEGELEIDING",
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: {
      representativeId: true,
      completedAt: true,
    },
  });
  const result = new Map<string, Date>();
  for (const intervention of interventions) {
    if (intervention.completedAt && !result.has(intervention.representativeId)) {
      result.set(intervention.representativeId, intervention.completedAt);
    }
  }
  return result;
}

function toRepresentative(
  user: RepresentativeUser,
  openActions: number,
  lastCoachingDate?: Date
): Representative {
  const representativeId = user.representativeId ?? user.id;
  const level = user.level?.name ?? "Vertegenwoordiger";
  const latestByKpi = latestSnapshotsByKpi(user.kpiSnapshots);
  return {
    id: representativeId,
    firstName: user.firstName,
    lastName: user.lastName,
    initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`,
    country: user.country as Country,
    team: user.team?.name ?? "",
    teamId: user.teamId ?? "",
    level: level as Representative["level"],
    levelColor: levelColors[level] ?? "bg-slate-100 text-slate-700",
    lastCoaching: lastCoachingDate ? formatDateNl(lastCoachingDate) : "Nog niet",
    openActions,
    email: user.email,
    phone: user.mobile ?? "",
    kpis: latestByKpi.map(({ current, previous }) => ({
      label: current.kpiDefinition.name,
      value: formatKpiValue(Number(current.value), current.kpiDefinition.unit),
      target: formatKpiValue(Number(current.target ?? resolveKpiTargetFromDefinition(
        current.kpiDefinition,
        { country: user.country, teamId: user.teamId ?? undefined, userId: user.id }
      ).targetValue), current.kpiDefinition.unit),
      trend:
        previous && Number(current.value) > Number(previous.value)
          ? 1
          : previous && Number(current.value) < Number(previous.value)
            ? -1
            : 0,
    })),
  };
}

function latestSnapshotsByKpi(snapshots: RepresentativeUser["kpiSnapshots"]) {
  const byKpi = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const current = byKpi.get(snapshot.kpiDefinitionId) ?? [];
    current.push(snapshot);
    byKpi.set(snapshot.kpiDefinitionId, current);
  }
  return [...byKpi.values()].flatMap((items) => {
    const sorted = [...items].sort((left, right) => right.periodEnd.getTime() - left.periodEnd.getTime());
    return sorted[0] ? [{ current: sorted[0], previous: sorted[1] }] : [];
  });
}

function formatKpiValue(value: number, unit: string) {
  if (unit === "%") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 1 })}%`;
  if (unit === "EUR") return `€ ${value.toLocaleString("nl-BE", { maximumFractionDigits: 0 })}`;
  if (unit === "minutes") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} min`;
  if (unit === "hours") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} u`;
  if (unit === "km") return `${value.toLocaleString("nl-BE", { maximumFractionDigits: 2 })} km`;
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

function formatDateNl(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
