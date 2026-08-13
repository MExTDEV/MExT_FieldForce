import { ApiRequestError, notFound } from "@/lib/server/api";
import { getMailAssetForRequest, mailAssetEtag } from "@/lib/server/mail-assets";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { bytes, mimeType } = await getMailAssetForRequest((await params).id);
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: mailAssetEtag(bytes),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status, headers: { "Content-Type": "application/json" } });
    }
    notFound("Mailafbeelding niet gevonden.");
  }
}
