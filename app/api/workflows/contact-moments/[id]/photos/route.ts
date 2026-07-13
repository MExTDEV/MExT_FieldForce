import { badRequest, handleApi } from "@/lib/server/api";
import { uploadContactMomentPhoto } from "@/lib/server/contact-moment-photos";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/contact-moments/photos:post", async () => {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      badRequest("Selecteer een foto om te uploaden.");
    }
    const actorId = new URL(request.url).searchParams.get("actorId");
    return uploadContactMomentPhoto((await params).id, file, actorId);
  }, "De foto kon niet worden opgeladen.");
}
