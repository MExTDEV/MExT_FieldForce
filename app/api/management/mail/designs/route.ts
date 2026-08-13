import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listMailDesigns, saveMailDesign } from "@/lib/server/mail-management";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi("api/management/mail/designs:get", async () => {
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    return { designs: await listMailDesigns(actor) };
  }, "Herbruikbare maildesigns konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/management/mail/designs:post", async () => {
    const payload = await readJson(request);
    const actor = await requireAuthenticatedUser(payload.actorId);
    return { design: await saveMailDesign(actor, { name: String(payload.name ?? ""), bodyHtml: String(payload.bodyHtml ?? "") }) };
  }, "Het maildesign kon niet worden opgeslagen.");
}

async function readJson(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { badRequest("De aanvraag bevat geen geldige JSON."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) badRequest("De aanvraag is ongeldig.");
  const object = payload as Record<string, unknown>;
  if (typeof object.actorId !== "string") badRequest("Een actor is verplicht.");
  return object as { actorId: string; [key: string]: unknown };
}
