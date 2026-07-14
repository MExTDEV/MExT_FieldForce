import { badRequest, handleApi } from "@/lib/server/api";
import { uploadContactMomentPhotos } from "@/lib/server/contact-moment-photos";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApi("api/workflows/contact-moments/photos:post", async () => {
    const formData = await request.formData();
    const files = formData.getAll("file").filter((file): file is File => file instanceof File);
    if (!files.length) {
      badRequest("Selecteer een foto om te uploaden.");
    }
    const actorId = new URL(request.url).searchParams.get("actorId");
    return uploadContactMomentPhotos((await params).id, files, actorId);
  }, "De foto kon niet worden opgeladen.");
}
