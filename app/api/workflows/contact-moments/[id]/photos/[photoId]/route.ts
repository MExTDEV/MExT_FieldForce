import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/server/api";
import {
  deleteContactMomentPhoto,
  getContactMomentPhotoForRequest,
} from "@/lib/server/contact-moment-photos";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const { id, photoId } = await params;
    const { photo, bytes } = await getContactMomentPhotoForRequest(id, photoId, actorId);
    return new Response(bytes, {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Length": String(photo.size),
        "Content-Disposition": `inline; filename="${encodeURIComponent(photo.originalName)}"`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 500;
    const message = error instanceof ApiRequestError
      ? error.message
      : "De foto kon niet worden opgehaald.";
    console.error("[api/workflows/contact-moments/photos:get]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const actorId = new URL(request.url).searchParams.get("actorId");
    const { id, photoId } = await params;
    return NextResponse.json(await deleteContactMomentPhoto(id, photoId, actorId));
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 500;
    const message = error instanceof ApiRequestError
      ? error.message
      : "De foto kon niet worden verwijderd.";
    console.error("[api/workflows/contact-moments/photos:delete]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
