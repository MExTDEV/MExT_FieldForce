import { NextResponse } from "next/server";

import { ApiRequestError, handleApi } from "@/lib/server/api";
import {
  requireAuthenticatedUser,
  requirePermission,
  requireRole,
} from "@/lib/server/authenticated-user";
import {
  exportManagementTopic,
  importManagementTopic,
  parseManagementImportTopic,
} from "@/lib/server/management-import-export";
import type { ManagementImportMode } from "@/lib/management-import-export";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ topic: string }> }
) {
  try {
    const topic = parseManagementImportTopic((await params).topic);
    const actor = await requireAuthenticatedUser(
      new URL(request.url).searchParams.get("actorId")
    );
    requireRole(actor, ["SUPER_ADMIN"]);
    requirePermission(actor, "technicalImportExport");

    const exportFile = await exportManagementTopic(topic);
    return new Response(exportFile.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
      },
    });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 500;
    const message = error instanceof ApiRequestError
      ? error.message
      : "Export kon niet worden gemaakt.";
    console.error("[api/management/import-export:get]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ topic: string }> }
) {
  return handleApi("api/management/import-export:post", async () => {
    const topic = parseManagementImportTopic((await params).topic);
    const body = await request.json() as {
      actorId?: string;
      mode?: ManagementImportMode;
      csv?: string;
    };
    const actor = await requireAuthenticatedUser(body.actorId);
    requireRole(actor, ["SUPER_ADMIN"]);
    requirePermission(actor, "technicalImportExport");

    return importManagementTopic(
      actor,
      topic,
      typeof body.csv === "string" ? body.csv : "",
      body.mode === "commit" ? "commit" : "validate"
    );
  }, "Import kon niet worden verwerkt.");
}
