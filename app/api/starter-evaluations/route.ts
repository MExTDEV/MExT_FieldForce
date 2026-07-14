import { NextResponse } from "next/server";
import { ApiRequestError, badRequest, handleApi } from "@/lib/server/api";
import { requireAuthenticatedUser } from "@/lib/server/authenticated-user";
import { writeAuditLog } from "@/lib/server/audit";
import {
  createManualStarterEvaluation,
  listManualStarterEvaluationCandidates,
  StarterEvaluationDuplicateError,
} from "@/lib/server/starter-evaluations";

export async function GET(request: Request) {
  return handleApi("api/starter-evaluations:get", async () => {
    const url = new URL(request.url);
    const actor = await requireAuthenticatedUser(url.searchParams.get("actorId"));
    return { candidates: await listManualStarterEvaluationCandidates(actor) };
  }, "Tussentijdse evaluaties konden niet worden geladen.");
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      actorId?: string;
      representativeId?: string;
      evaluationDate?: string;
    };
    const actor = await requireAuthenticatedUser(payload.actorId);
    if (!payload.representativeId) badRequest("Selecteer een vertegenwoordiger.");
    const result = await createManualStarterEvaluation({
      actor,
      representativeId: payload.representativeId,
      evaluationDate: payload.evaluationDate ?? "",
    });
    await writeAuditLog({
      actorId: actor.id,
      entityType: "StarterEvaluation",
      entityId: result.evaluation.id,
      action: "starterEvaluation.manualStart",
      newValue: {
        actorName: actor.name,
        representativeName: result.evaluation.representativeName,
        evaluationDate: result.evaluation.evaluationDate,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof StarterEvaluationDuplicateError) {
      return NextResponse.json({
        error: error.message,
        duplicate: true,
        existingEvaluationId: error.existingEvaluationId,
        href: error.href,
      }, { status: 409 });
    }
    const status = error instanceof ApiRequestError ? error.status : 500;
    const message = error instanceof ApiRequestError
      ? error.message
      : "De tussentijdse evaluatie kon niet worden gestart.";
    console.error("[api/starter-evaluations:post]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
