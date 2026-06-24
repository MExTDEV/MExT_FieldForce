import { prisma } from "@/lib/server/db";
import type { FieldForceConfiguration } from "@/lib/types";

const focusColors: Record<string, string> = {
  INTRO: "bg-blue-500",
  NEED: "bg-violet-500",
  DEMO: "bg-cyan-500",
  CLOSE: "bg-amber-500",
  CASE: "bg-emerald-500",
};

export async function getFieldForceConfiguration(): Promise<FieldForceConfiguration> {
  const [focuses, kpis] = await Promise.all([
    prisma.coachingFocus.findMany({
      where: { active: true },
      include: {
        criteria: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.kpiDefinition.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
      select: { name: true },
    }),
  ]);

  return {
    coachingFramework: focuses.map((focus) => ({
      id: focus.id,
      code: focus.code,
      name: focus.name,
      color: focusColors[focus.code] ?? "bg-slate-500",
      criteria: focus.criteria.map((criterion) => criterion.name),
    })),
    kpiDefinitions: kpis.map((kpi) => kpi.name),
  };
}
