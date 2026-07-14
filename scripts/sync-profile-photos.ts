import { runNightlyProfilePhotoSync } from "@/lib/server/profile-photo-sync";

async function main() {
  const result = await runNightlyProfilePhotoSync();
  console.log(JSON.stringify({
    started: result.started,
    runId: result.run.id,
    status: result.run.status,
    checkedUsers: result.run.checkedUsers,
    updatedPhotos: result.run.updatedPhotos,
    unchangedPhotos: result.run.unchangedPhotos,
    noPhotoUsers: result.run.noPhotoUsers,
    skippedUsers: result.run.skippedUsers,
    errorUsers: result.run.errorUsers,
  }, null, 2));
  if (result.run.status === "ERROR") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
