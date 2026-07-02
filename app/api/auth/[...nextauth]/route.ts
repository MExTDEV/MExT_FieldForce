import { handlers } from "@/auth";
import { withLoginRequestContext } from "@/lib/server/login-history";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return withLoginRequestContext(request, () => handlers.GET(request));
}

export function POST(request: NextRequest) {
  return withLoginRequestContext(request, () => handlers.POST(request));
}
