import { WorkspacePage } from "@/components/workspace-pages";

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  return <WorkspacePage segments={slug} />;
}
