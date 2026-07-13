import assert from "node:assert/strict";
import {
  defaultMailTestRecipient,
  effectiveMailTestActive,
  isMailTestForced,
  mailTestProductionConfirmation,
  mailTestRecipient,
  normalizeMailTestRecipient,
  routeMailThroughMailTest,
} from "@/lib/server/mail-test";
import {
  mailSettingsFromValues,
  normalizeMailSettingsUpdate,
  redactMailSettings,
} from "@/lib/server/mail-settings";

const original = {
  to: ["original.one@mext.be", "original.one@mext.be", "original.two@mext.be"],
  cc: ["copy@mext.be"],
  bcc: ["hidden@mext.be"],
};
const context = {
  sourceModule: "Coaching",
  entityType: "Intervention",
  entityId: "coaching-1",
  eventKey: "coaching-1:approval",
  reason: "Gerichte MAIL TEST-regressietest",
  sentAt: new Date("2026-07-11T08:00:00.000Z"),
};

const routed = routeMailThroughMailTest({
  mailTestActive: true,
  envelope: original,
  context,
});
assert.deepEqual(routed.envelope, {
  to: [mailTestRecipient],
  cc: [],
  bcc: [],
});
assert.equal(mailTestRecipient, defaultMailTestRecipient);
assert.deepEqual(routed.original, {
  to: ["original.one@mext.be", "original.two@mext.be"],
  cc: ["copy@mext.be"],
  bcc: ["hidden@mext.be"],
});
assert.match(routed.testWarning ?? "", /MAIL TEST is actief/);
assert.match(routed.testWarning ?? "", /original\.one@mext\.be/);

const routedToConfiguredRecipient = routeMailThroughMailTest({
  mailTestActive: true,
  mailTestRecipient: "fieldforce-test@mext.be",
  envelope: original,
  context,
});
assert.deepEqual(routedToConfiguredRecipient.envelope, {
  to: ["fieldforce-test@mext.be"],
  cc: [],
  bcc: [],
});
assert.equal(normalizeMailTestRecipient(" geen-mail "), undefined);
assert.equal(normalizeMailTestRecipient("  fieldforce-test@mext.be  "), "fieldforce-test@mext.be");

const forcedDevelopment = routeMailThroughMailTest({
  mailTestActive: false,
  mailTestRecipient: "fieldforce-test@mext.be",
  envelope: original,
  context,
  runtimeEnvironment: "production",
  deploymentEnvironment: "staging",
});
assert.equal(forcedDevelopment.mailTestActive, true);
assert.deepEqual(forcedDevelopment.envelope, {
  to: ["fieldforce-test@mext.be"],
  cc: [],
  bcc: [],
});

const production = routeMailThroughMailTest({
  mailTestActive: false,
  envelope: original,
  context,
  runtimeEnvironment: "production",
  deploymentEnvironment: "production",
});
assert.deepEqual(production.envelope, production.original);
assert.equal(production.testWarning, undefined);
assert.equal(mailTestProductionConfirmation, "PRODUCTIE");

const settings = mailSettingsFromValues(new Map([
  ["MAIL_TEST", "true"],
  ["MAIL_TEST_RECIPIENT", "fieldforce-test@mext.be"],
  ["MAIL_SMTP_ENABLED", "true"],
  ["MAIL_SMTP_HOST", "smtp.mext.be"],
  ["MAIL_SMTP_PORT", "587"],
  ["MAIL_SMTP_SECURITY", "starttls"],
  ["MAIL_SMTP_AUTH_TYPE", "password"],
  ["MAIL_SMTP_USERNAME", "fieldforce@mext.be"],
  ["MAIL_SMTP_PASSWORD", "enc:v1:secret"],
  ["MAIL_DEFAULT_FROM_EMAIL", "fieldforce@mext.be"],
  ["MAIL_DEFAULT_FROM_NAME", "MExT FieldForce"],
  ["MAIL_DEFAULT_REPLY_TO_EMAIL", "helpdesk@mext.be"],
]));

assert.equal(settings.mailTest.active, true);
assert.equal(settings.mailTest.locked, true);
assert.equal(settings.mailTest.recipient, "fieldforce-test@mext.be");
assert.equal(isMailTestForced("development", "staging"), true);
assert.equal(isMailTestForced("test", "staging"), true);
assert.equal(isMailTestForced("production", "staging"), true);
assert.equal(isMailTestForced("production", "production"), false);
assert.equal(effectiveMailTestActive(false, "development", "staging"), true);
assert.equal(effectiveMailTestActive(false, "production", "staging"), true);
assert.equal(effectiveMailTestActive(false, "production", "production"), false);

const disabledStoredValues = new Map([["MAIL_TEST", "false"]]);
const forcedSettings = mailSettingsFromValues(disabledStoredValues, "production", "staging");
assert.equal(forcedSettings.mailTest.active, true);
assert.equal(forcedSettings.mailTest.locked, true);
const productionSettings = mailSettingsFromValues(disabledStoredValues, "production", "production");
assert.equal(productionSettings.mailTest.active, false);
assert.equal(productionSettings.mailTest.locked, false);
assert.equal(settings.smtp.enabled, true);
assert.equal(settings.smtp.host, "smtp.mext.be");
assert.equal(settings.smtp.port, 587);
assert.equal(settings.smtp.security, "starttls");
assert.equal(settings.smtp.authType, "password");
assert.equal(settings.smtp.passwordConfigured, true);
assert.equal(settings.ready, true);
assert.deepEqual(settings.missing, []);

const redacted = redactMailSettings(settings);
assert.equal(redacted.smtp.username, "***");
assert.equal(redacted.smtp.passwordConfigured, true);
assert.equal("smtpPassword" in redacted.smtp, false);

const normalized = normalizeMailSettingsUpdate({
  mailTestActive: true,
  mailTestRecipient: "  fieldforce-test@mext.be ",
  smtpEnabled: true,
  smtpHost: " smtp.mext.be ",
  smtpPort: 587,
  smtpSecurity: "starttls",
  smtpAuthType: "password",
  smtpUsername: " fieldforce@mext.be ",
  smtpPassword: "supersecret",
  defaultFromEmail: " fieldforce@mext.be ",
  defaultFromName: " MExT FieldForce ",
  defaultReplyToEmail: " helpdesk@mext.be ",
});

assert.equal(normalized.mailTestRecipient, "fieldforce-test@mext.be");
assert.equal(normalized.smtpHost, "smtp.mext.be");
assert.equal(normalized.smtpUsername, "fieldforce@mext.be");
assert.equal(normalized.defaultFromEmail, "fieldforce@mext.be");
assert.equal(normalized.defaultFromName, "MExT FieldForce");

assert.throws(() => normalizeMailSettingsUpdate({
  ...normalized,
  mailTestActive: false,
  confirmation: mailTestProductionConfirmation,
}, "production", "staging"), /ontwikkel- of testomgeving/);
assert.throws(() => normalizeMailSettingsUpdate({
  ...normalized,
  mailTestActive: false,
  confirmation: "WRONG",
}, "production", "production"), /PRODUCTIE/);
assert.equal(normalizeMailSettingsUpdate({
  ...normalized,
  mailTestActive: false,
  confirmation: mailTestProductionConfirmation,
}, "production", "production").mailTestActive, false);
assert.throws(() => normalizeMailSettingsUpdate({
  ...normalized,
  smtpPort: 70000,
}), /SMTP-poort/);
assert.throws(() => normalizeMailSettingsUpdate({
  ...normalized,
  defaultFromEmail: "geen-mail",
}), /Standaard afzender/);

console.log("MAIL TEST-router, productiebevestiging en SMTP-mailinstellingen gevalideerd.");
