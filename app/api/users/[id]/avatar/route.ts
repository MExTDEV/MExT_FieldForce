import { NextResponse } from "next/server";

import { ApiRequestError, badRequest } from "@/lib/server/api";
import { requireAuthenticatedRead } from "@/lib/server/authenticated-user";
import { writeAuditLog } from "@/lib/server/audit";
import {
  getUserAvatarForRequest,
  uploadManagedUserAvatar,
} from "@/lib/server/user-avatar";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuthenticatedRead();
    const { id } = await params;
    const { bytes, mimeType } = await getUserAvatarForRequest(id, actor);
    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 404;
    const message = error instanceof Error ? error.message : "Gebruikersfoto kon niet worden opgehaald.";
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) badRequest("Selecteer een foto om te uploaden.");
    const actorIdValue = formData.get("actorId");
    const actorId = typeof actorIdValue === "string"
      ? actorIdValue
      : undefined;
    const user = await uploadManagedUserAvatar(id, file, actorId);
    if (actorId) {
      await writeAuditLog({
        actorId,
        entityType: "User",
        entityId: id,
        action: "user.avatar.upload",
        newValue: { avatarUrl: user.avatarUrl },
      });
    }
    return NextResponse.json({ user });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Gebruikersfoto kon niet worden opgeladen.";
    return NextResponse.json({ error: message }, { status });
  }
}
