import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiRequestError } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { getContractGeneratedDocumentForDownload } from "@/lib/contract/letter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actor = await requireAuthenticatedUser(request.nextUrl.searchParams.get("actorId"));
    const { bytes, fileName } = await getContractGeneratedDocumentForDownload(actor, id);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
        "ETag": `"${createHash("sha256").update(bytes).digest("hex")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 404;
    const message = error instanceof Error ? error.message : "Contractdocument kon niet worden opgehaald.";
    return Response.json({ error: message }, { status });
  }
}
