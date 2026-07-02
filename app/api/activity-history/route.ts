import { handleApi } from "@/lib/server/api";
import { listActivityHistory } from "@/lib/server/activity-history";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { buildVisibleCoachingWhere } from "@/lib/server/coaching-visibility";
import { prisma } from "@/lib/server/db";
import { writeAuditLog } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi("api/activity-history:get", async () => {
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 29);
    defaultFrom.setHours(0, 0, 0, 0);
    const from = parseDate(url.searchParams.get("from"), defaultFrom, false);
    const to = parseDate(url.searchParams.get("to"), now, true);
    const page = positiveInteger(url.searchParams.get("page"), 1, 10_000);
    const pageSize = positiveInteger(url.searchParams.get("pageSize"), 25, 100);
    return listActivityHistory(actor, {
      from,
      to,
      teamId: url.searchParams.get("teamId") || undefined,
      representativeId: url.searchParams.get("representativeId") || undefined,
      page,
      pageSize,
    });
  }, "De actiehistoriek kon niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/activity-history:post", async () => {
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    const payload = await request.json() as { interventionId?: string; action?: string };
    if (!payload.interventionId || payload.action !== "pdf_exported") return { ok: false };
    const coaching = await prisma.intervention.findFirst({
      where: buildVisibleCoachingWhere(actor, { id: payload.interventionId }),
      select: { id: true, title: true },
    });
    if (!coaching) return { ok: false };
    await writeAuditLog({
      actorId: actor.id,
      entityType: "Intervention",
      entityId: coaching.id,
      action: "coaching.pdf_exported",
      newValue: { description: `Professioneel PDF-rapport geëxporteerd: ${coaching.title}` },
    });
    return { ok: true };
  }, "De PDF-export kon niet in de actiehistoriek worden geregistreerd.");
}

function parseDate(value: string | null, fallback: Date, endOfDay: boolean) {
  const parsed = value ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`) : new Date(fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}
