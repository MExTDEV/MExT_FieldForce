import { loadEnvFile } from "node:process";

loadEnvFile();

async function main() {
  const baseUrl = process.env.APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as { status?: string };

  if (!response.ok || payload.status !== "ok") {
    throw new Error(`Health check failed with HTTP ${response.status}.`);
  }

  console.log(`Health check passed for ${baseUrl}.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
