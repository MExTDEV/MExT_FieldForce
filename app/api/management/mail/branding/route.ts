import { badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getMailBranding, publishMailFooterVersion, saveMailBranding } from "@/lib/server/mail-management";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApi("api/management/mail/branding:get", async () => {
    const actor = await requireAuthenticatedUser(new URL(request.url).searchParams.get("actorId"));
    return { branding: await getMailBranding(actor) };
  }, "De e-mailbranding kon niet worden geladen.");
}

export async function POST(request: Request) {
  return handleApi("api/management/mail/branding:post", async () => {
    const payload = await readJson(request);
    const actor = await requireAuthenticatedUser(payload.actorId);
    if (payload.action === "publish" && typeof payload.versionId === "string") {
      return { version: await publishMailFooterVersion(actor, payload.versionId) };
    }
    if (payload.action !== "save") badRequest("Onbekende brandingactie.");
    return {
      branding: await saveMailBranding(actor, {
        country: payload.country as "BE" | "NL" | "DE",
        senderName: optionalString(payload.senderName),
        replyToEmail: optionalString(payload.replyToEmail),
        supportEmail: optionalString(payload.supportEmail),
        supportPhone: optionalString(payload.supportPhone),
        logoUrl: optionalString(payload.logoUrl),
        footerLanguage: payload.footerLanguage as "nl" | "fr" | "de",
        footerHtml: String(payload.footerHtml ?? ""),
        changeNote: optionalString(payload.changeNote),
      }),
    };
  }, "De e-mailbranding kon niet worden opgeslagen.");
}

async function readJson(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { badRequest("De aanvraag bevat geen geldige JSON."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) badRequest("De aanvraag is ongeldig.");
  const object = payload as Record<string, unknown>;
  if (typeof object.actorId !== "string") badRequest("Een actor is verplicht.");
  return object as { actorId: string; action?: string; versionId?: string; [key: string]: unknown };
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
