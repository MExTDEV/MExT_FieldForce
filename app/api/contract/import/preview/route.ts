import type { NextRequest } from "next/server";
import { handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { previewContractWorkbook } from "@/lib/contract/services";

export async function POST(request: NextRequest) {
  return handleApi("contract.import.preview", async () => {
    const form = await request.formData();
    const actor = await requireAuthenticatedUser(String(form.get("actorId") ?? ""));
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("contract.import.error.fileRequired");
    const buffer = Buffer.from(await file.arrayBuffer());
    return previewContractWorkbook(actor, file.name, buffer);
  });
}
