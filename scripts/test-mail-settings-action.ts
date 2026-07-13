import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildMailSettingsTestTemplate } from "@/lib/server/mail-templates";

const root = process.cwd();
const component = readFileSync(join(root, "components", "settings-management.tsx"), "utf8");
const route = readFileSync(
  join(root, "app", "api", "management", "settings", "mail-test", "route.ts"),
  "utf8"
);
const service = readFileSync(join(root, "lib", "server", "mail-service.ts"), "utf8");

const dutchTemplate = buildMailSettingsTestTemplate({
  language: "nl",
  actorName: "Admin <script>",
  recipient: "fieldforce-test@mext.be",
});
assert.equal(dutchTemplate.subject, "Testmail MExT FieldForce");
assert.match(dutchTemplate.text, /fieldforce-test@mext.be/);
assert.match(dutchTemplate.text, /Admin <script>/);
assert.match(dutchTemplate.html, /Admin &lt;script&gt;/);
assert.doesNotMatch(dutchTemplate.html, /Admin <script>/);

const frenchTemplate = buildMailSettingsTestTemplate({
  language: "fr",
  actorName: "Administrateur",
  recipient: "fieldforce-test@mext.be",
});
assert.equal(frenchTemplate.subject, "E-mail test MExT FieldForce");
assert.match(frenchTemplate.html, /Destinataire de test/);

const germanTemplate = buildMailSettingsTestTemplate({
  language: "de",
  actorName: "Administrator",
  recipient: "fieldforce-test@mext.be",
});
assert.equal(germanTemplate.subject, "Test-E-Mail MExT FieldForce");
assert.match(germanTemplate.html, /Testempfänger/);

assert.match(component, /method: "POST"/);
assert.match(component, /settings\.mailTest\.sendTest/);
assert.match(component, /!mailSettings\?\.ready \|\| hasUnsavedMailChanges/);
assert.match(route, /export async function POST/);
assert.ok(
  route.indexOf("requireSettingsAccess(actor)") <
    route.indexOf("await sendMailSettingsTest"),
  "De server-side toegangscontrole moet voor het verzenden plaatsvinden."
);
assert.match(route, /if \(!settings\.ready\)/);
assert.match(route, /recipient: settings\.mailTest\.recipient/);
assert.match(service, /export async function sendMailSettingsTest/);
assert.match(service, /return sendFieldForceMail\(/);
assert.match(service, /envelope: \{ to: \[input\.recipient\] \}/);

console.log(
  "Testmailknop, serverbeveiliging, centrale mailservice en NL/FR/DE-template gevalideerd."
);