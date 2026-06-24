import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database health check timed out.")), 5_000)
      ),
    ]);
    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        responseTimeMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[health]", error);
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        responseTimeMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
