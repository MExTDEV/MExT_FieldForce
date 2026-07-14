import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const schema = read("prisma/schema.prisma");
assert.match(schema, /enum UserProfilePhotoSyncStatus/);
assert.match(schema, /model ProfilePhotoSyncRun/);
assert.match(schema, /profilePhotoStorageKey/);
assert.match(schema, /profilePhotoHash/);
assert.match(schema, /profilePhotoSyncStatus/);

const migration = read("prisma/migrations/0033_user_profile_photo_sync/migration.sql");
assert.match(migration, /CREATE TABLE `ProfilePhotoSyncRun`/);
assert.match(migration, /ENUM\('SYNCED', 'NO_PHOTO', 'SKIPPED', 'ERROR'\)/);

const service = read("lib/server/profile-photo-sync.ts");
assert.match(service, /\/users\/\$\{encodeURIComponent\(graphUserId\)\}\/photo\/\$value/);
assert.match(service, /ProfilePhoto\.Read\.All/);
assert.match(service, /retry-after/i);
assert.match(service, /maxAttempts = 3/);
assert.match(service, /PROFILE_PHOTO_SYNC_CONCURRENCY/);
assert.match(service, /deleteStoredUserAvatar/);
assert.match(service, /profilePhotoSyncStatus: "NO_PHOTO"/);
assert.match(service, /status: "RUNNING"/);

const avatar = read("lib/server/user-avatar.ts");
assert.match(avatar, /createHash\("sha256"\)/);
assert.match(avatar, /rename\(avatarPath/);
assert.match(avatar, /profilePhotoStorageKey/);
assert.doesNotMatch(avatar, /\/me\/photo\/\$value[^]*storeUserAvatarBytes\(userId, photo\.bytes/);

const avatarComponent = read("components/ui.tsx");
assert.match(avatarComponent, /onError=\{\(\) => setImageFailed\(true\)\}/);
assert.match(avatarComponent, /useEffect\(\(\) => \{\s*setImageFailed\(false\);/);

const route = read("app/api/management/settings/profile-photos/route.ts");
assert.match(route, /canAccessManagementSection\(actor, "instellingen"\)/);
assert.match(route, /startProfilePhotoSyncRun/);

const settings = read("components/settings-management.tsx");
assert.match(settings, /settings\.microsoftPhoto\.syncButton/);
assert.match(settings, /setInterval\(\(\) => void loadPhotoSync\(\), 3000\)/);

const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
assert.equal(packageJson.scripts["profile-photos:sync"], "tsx scripts/sync-profile-photos.ts");

for (const locale of ["nl", "fr", "de"]) {
  const parsed = JSON.parse(read(`locales/${locale}.json`)) as Record<string, string>;
  assert.ok(parsed["settings.microsoftPhoto.title"], `${locale} title missing`);
  assert.ok(parsed["settings.microsoftPhoto.syncButton"], `${locale} button missing`);
}

console.log("Microsoft-profielfoto sync statisch gecontroleerd.");
