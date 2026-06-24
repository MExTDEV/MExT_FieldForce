import { WorkspacePage } from "@/components/workspace-pages";
import { requirePageAuthentication } from "@/lib/server/page-auth";

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  await requirePageAuthentication(`/${slug.join("/")}`);
  return <WorkspacePage segments={slug} />;
}
