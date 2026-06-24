import { redirect } from "next/navigation";
import { auth, authMode } from "@/auth";

export async function requirePageAuthentication(callbackUrl: string) {
  if (authMode === "demo") return;
  const session = await auth();
  if (!session?.user?.databaseUserId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
}
