import { Suspense } from "react";
import { CoachingWizard } from "@/components/coaching-wizard";

export default function NewCoachingPage() {
  return (
    <Suspense fallback={<div className="card min-h-96 animate-pulse bg-white" />}>
      <CoachingWizard />
    </Suspense>
  );
}
