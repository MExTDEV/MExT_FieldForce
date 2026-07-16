import { ContractWorkspace } from "@/components/contract/contract-workspace";
import { requirePageAuthentication } from "@/lib/server/page-auth";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  await requirePageAuthentication(`/contract${segments.length ? `/${segments.join("/")}` : ""}`);
  return <ContractWorkspace segments={segments} />;
}
