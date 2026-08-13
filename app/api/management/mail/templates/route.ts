import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listMailTemplateRows, saveMailTemplateDraft, type MailTemplateDraftInput } from "@/lib/server/mail-management";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi("api/management/mail/templates:get", async () => {
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    return { templates: await listMailTemplateRows(actor) };
  }, "E-mailsjablonen konden niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/management/mail/templates:post", async () => {
    const payload = await readJson(request);
    const actor = await requireAuthenticatedUser(payload.actorId);
    return { draft: await saveMailTemplateDraft(actor, payload as MailTemplateDraftInput & { actorId: string }) };
  }, "Het e-mailsjabloon kon niet als concept worden opgeslagen.");
}

async function readJson(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    badRequest("De aanvraag bevat geen geldige JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) badRequest("De aanvraag is ongeldig.");
  const object = payload as Record<string, unknown>;
  if (typeof object.actorId !== "string") badRequest("Een actor is verplicht.");
  return object as { actorId: string } & Record<string, unknown>;
}
