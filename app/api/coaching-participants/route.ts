import { handleApi } from "@/lib/server/api";
import { actorCountryWhere, requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { prisma } from "@/lib/server/db";
import { canCreateIntervention } from "@/lib/permissions";

export async function GET(request: Request) {
  return handleApi("api/coaching-participants:get", async () => {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const actor = await requireAuthenticatedUser(actorId);
    if (!canCreateIntervention(actor)) {
      return { participants: [] };
    }
    const users = await prisma.user.findMany({
      where: {
        active: true,
        id: { not: actor.id },
        role: actor.role === "SALES_LEADER" ? "REPRESENTATIVE" : { in: ["REPRESENTATIVE", "SALES_LEADER"] },
        ...(actor.role === "SALES_LEADER"
          ? { teamId: actor.teamId ?? "__geen_team__" }
          : ["COUNTRY_MANAGER", "SALES_MANAGER", "ADMIN"].includes(actor.role)
            ? actorCountryWhere(actor)
            : {}),
      },
      include: { team: { select: { name: true } } },
      orderBy: [{ country: "asc" }, { team: { name: "asc" } }, { role: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    });
    return {
      participants: users.map((user) => ({
        id: user.representativeId ?? user.id,
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`,
        role: user.role,
        representativeLevel: user.representativeLevel,
        country: user.country,
        teamId: user.teamId ?? "",
        team: user.team?.name ?? "Geen team",
      })),
    };
  }, "Begeleidbare personen konden niet worden geladen.");
}
