import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  extensionForUserAvatarMimeType,
  isAllowedUserAvatarType,
  maxUserAvatarSize,
  userAvatarAccept,
  userAvatarMimeTypeForExtension,
} from "../lib/user-avatar";

const root = process.cwd();

assert.equal(isAllowedUserAvatarType("image/jpeg"), true);
assert.equal(isAllowedUserAvatarType("image/png"), true);
assert.equal(isAllowedUserAvatarType("image/webp"), true);
assert.equal(isAllowedUserAvatarType("image/gif"), false);
assert.equal(extensionForUserAvatarMimeType("image/jpeg"), ".jpg");
assert.equal(extensionForUserAvatarMimeType("image/png"), ".png");
assert.equal(extensionForUserAvatarMimeType("image/webp"), ".webp");
assert.equal(userAvatarMimeTypeForExtension(".jpg"), "image/jpeg");
assert.equal(userAvatarMimeTypeForExtension(".png"), "image/png");
assert.equal(userAvatarMimeTypeForExtension(".webp"), "image/webp");
assert.ok(userAvatarAccept.includes("image/jpeg"));
assert.equal(maxUserAvatarSize, 2 * 1024 * 1024);

const serverSource = readFileSync(join(root, "lib", "server", "user-avatar.ts"), "utf8");
assert.match(
  serverSource,
  /userManagementCapabilities\(actor,\s*target\)\.canEditPersonal/,
  "Avatar-upload moet dezelfde persoonlijke edit-scope afdwingen als gebruikersbeheer."
);
assert.match(
  serverSource,
  /FIELD_FORCE_UPLOAD_ROOT/,
  "Gebruikersavatars moeten dezelfde private uploadroot gebruiken als andere uploads."
);

const authSource = readFileSync(join(root, "auth.ts"), "utf8");
assert.match(
  authSource,
  /syncUserAvatarFromMicrosoft/,
  "Microsoft-accountfoto moet bij Entra-login als initiële avatarbron worden opgehaald."
);

console.log("Gebruikersavatar-regels gecontroleerd.");
