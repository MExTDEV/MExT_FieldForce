import { generateDueStarterEvaluations } from "@/lib/server/starter-evaluations";

async function main() {
  const result = await generateDueStarterEvaluations();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

void main();
