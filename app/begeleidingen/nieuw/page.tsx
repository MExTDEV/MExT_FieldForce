import { Suspense } from "react";
import { CoachingWizard } from "@/components/coaching-wizard";
import { requirePageAuthentication } from "@/lib/server/page-auth";

export default async function NewCoachingPage() {
  await requirePageAuthentication("/begeleidingen/nieuw");
  return (
    <Suspense fallback={<div className="card min-h-96 animate-pulse bg-white" />}>
      <CoachingWizard />
    </Suspense>
  );
}
