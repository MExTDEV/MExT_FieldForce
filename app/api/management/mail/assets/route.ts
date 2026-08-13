import { badRequest, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { uploadMailAsset } from "@/lib/server/mail-assets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApiCreated("api/management/mail/assets:post", async () => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) badRequest("Selecteer een afbeelding om te uploaden.");
    const actorId = formData.get("actorId");
    if (typeof actorId !== "string" || !actorId) badRequest("Een actor is verplicht.");
    const actor = await requireAuthenticatedUser(actorId);
    const altText = formData.get("altText");
    return { asset: await uploadMailAsset(actor, file, typeof altText === "string" ? altText : "") };
  }, "De mailafbeelding kon niet worden opgeladen.");
}
