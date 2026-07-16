import type { NextRequest } from "next/server";
import { badRequest, handleApi, handleApiCreated } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { listContractLetterTemplates, uploadContractLetterTemplate } from "@/lib/contract/letter";
import type { Language } from "@/lib/types";

export async function GET(request: NextRequest) {
  return handleApi("contract.letter.templates.list", async () => {
    const actor = await requireAuthenticatedUser(request.nextUrl.searchParams.get("actorId"));
    return listContractLetterTemplates(actor);
  });
}

export async function POST(request: NextRequest) {
  return handleApiCreated("contract.letter.templates.upload", async () => {
    const form = await request.formData();
    const actorId = form.get("actorId");
    const language = form.get("language");
    const file = form.get("file");
    if (!(file instanceof File)) badRequest("contract.letter.error.fileRequired");
    const actor = await requireAuthenticatedUser(typeof actorId === "string" ? actorId : undefined);
    return uploadContractLetterTemplate(actor, {
      language: language as Language,
      fileName: file.name,
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
  });
}
