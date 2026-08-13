import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getMailTemplateEditor, publishMailTemplateVersion, restoreMailTemplateVersion, saveMailTemplateDraft, sendMailTemplateTest, sendMailTemplateDraftTest } from "@/lib/server/mail-management";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  return handleApi("api/management/mail/templates/detail:get", async () => {
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    const scopeKey = new URL(request.url).searchParams.get("scopeKey") ?? "GLOBAL";
    return { template: await getMailTemplateEditor(actor, (await context.params).type, scopeKey) };
  }, "Het e-mailsjabloon kon niet worden geladen.");
}

export async function POST(request: Request, context: { params: Promise<{ type: string }> }) {
  return handleApi("api/management/mail/templates/detail:post", async () => {
    const payload = await readJson(request);
    const actor = await requireAuthenticatedUser(payload.actorId);
    const type = (await context.params).type;
    if (payload.action === "save") {
      return {
        draft: await saveMailTemplateDraft(actor, {
          type,
          scopeLevel: payload.scopeLevel as "GLOBAL" | "COUNTRY" | "MODULE" | "MODULE_COUNTRY",
          country: payload.country as "BE" | "NL" | "DE" | undefined,
          moduleCode: typeof payload.moduleCode === "string" ? payload.moduleCode : undefined,
          language: payload.language as "nl" | "fr" | "de",
          subject: String(payload.subject ?? ""),
          preheader: String(payload.preheader ?? ""),
          bodyHtml: String(payload.bodyHtml ?? ""),
          changeNote: typeof payload.changeNote === "string" ? payload.changeNote : undefined,
        }),
      };
    }
    const action = payload.action;
    if (action === "publish" && typeof payload.versionId === "string") {
      return { version: await publishMailTemplateVersion(actor, payload.versionId) };
    }
    if (action === "restore" && typeof payload.versionId === "string") {
      return { version: await restoreMailTemplateVersion(actor, payload.versionId) };
    }
    if (action === "test" && typeof payload.versionId === "string") {
      return { result: await sendMailTemplateTest(actor, payload.versionId) };
    }
    if (action === "testCurrent") {
      return { result: await sendMailTemplateDraftTest(actor, { type, country: payload.country as "BE" | "NL" | "DE", language: payload.language as "nl" | "fr" | "de", subject: String(payload.subject ?? ""), preheader: String(payload.preheader ?? ""), bodyHtml: String(payload.bodyHtml ?? "") }) };
    }
    badRequest(`Onbekende templateactie voor ${type}.`);
  }, "De templateactie kon niet worden uitgevoerd.");
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
  return object as { actorId: string; action?: string; versionId?: string; [key: string]: unknown };
}
