import { redirect } from "next/navigation";
import { requirePageAuthentication } from "@/lib/server/page-auth";

export default async function HomePage() {
  await requirePageAuthentication("/dashboard");
  redirect("/dashboard");
}
