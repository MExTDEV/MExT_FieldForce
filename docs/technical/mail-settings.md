# Mail settings

Date: 2026-07-14

## Purpose

FieldForce stores outbound mail configuration in `AppSetting` records. The settings are managed from `Beheer -> Instellingen -> Mail`.

The existing `MAIL TEST` safety switch remains the routing guard for outbound mail.

MAIL TEST can be disabled only when both `NODE_ENV` and `DEPLOYMENT_ENV` are
`production`. Development, test and staging therefore remain forced active, including
staging deployments that use a production build. The guard cannot be disabled through
the UI, API or stored setting. Every
outbound message is routed exclusively to the configured `MAIL_TEST_RECIPIENT`;
original to, cc, bcc and SMTP envelope recipients never receive the message.
When MAIL TEST is active and no valid test recipient is stored, delivery is
blocked. The service never falls back to original recipients.

Only a production runtime may disable MAIL TEST, and doing so still requires the
explicit confirmation word `PRODUCTIE`.

## AppSetting keys

- `MAIL_TEST`: `true` or `false`; defaults to active when absent and is overridden to active unless both runtime and deployment environment are production.
- `MAIL_TEST_RECIPIENT`: required test recipient while MAIL TEST is active.
- `MAIL_SMTP_ENABLED`: whether configured SMTP mail may be used.
- `MAIL_SMTP_HOST`: SMTP server hostname.
- `MAIL_SMTP_PORT`: SMTP port, 1-65535; default UI value is 587.
- `MAIL_SMTP_SECURITY`: `none`, `starttls`, or `tls`.
- `MAIL_SMTP_AUTH_TYPE`: `none` or `password`.
- `MAIL_SMTP_USERNAME`: username for password authentication.
- `MAIL_SMTP_PASSWORD`: encrypted stored password.
- `MAIL_DEFAULT_FROM_EMAIL`: default sender address.
- `MAIL_DEFAULT_FROM_NAME`: default sender display name.
- `MAIL_DEFAULT_REPLY_TO_EMAIL`: default reply-to address.

## Security

- The SMTP password is write-only in the UI.
- API responses expose only `passwordConfigured`, never the stored password value.
- Audit logs redact username and never include a password value.
- SMTP password storage requires `MAIL_SETTINGS_SECRET` or `AUTH_SECRET` with at least 16 characters.
- Development, test and staging force `MAIL TEST` active regardless of the stored value or build mode.
- The central router replaces every real to/cc/bcc recipient and the SMTP envelope with the configured test recipient.
- When MAIL TEST is active, the final provider message omits `replyTo` and the last guard blocks delivery if any provider recipient differs from the configured test recipient.
- When MAIL TEST is active without a valid configured test recipient, the mail is logged as an error and not sent.
- The settings API rejects attempts to disable MAIL TEST unless both runtime and deployment environment are production.
- The settings UI exposes the forced state as active and locked.
- The settings test action reads the SMTP configuration and test recipient again on the server; unsaved browser values are never used for delivery.
- The test action requires management access and refuses delivery while the stored SMTP configuration is incomplete.
- The original route is retained only as delivery metadata and in the MAIL TEST warning; it is used as the SMTP envelope only when both runtime and deployment environment are production and MAIL TEST was explicitly disabled.
- Workflow messages always use the configured FieldForce sender. When a triggering user exists, that user's stored e-mail address overrides the global reply-to address so replies return to the original sender.

## Incident root cause

The central MAIL TEST router already replaced the application-level `to`, `cc`
and `bcc` fields. The remaining risk was immediately before the provider call:
the generated Nodemailer message did not set an explicit SMTP `envelope`, kept a
workflow `replyTo` value when MAIL TEST was active, and accepted the hardcoded
default recipient when no valid test recipient was stored. This meant the final
provider payload was not guarded against future direct recipient fields or
invalid test-recipient configuration. The service now constructs the effective
provider envelope from the routed recipients, clears `replyTo` in MAIL TEST mode,
blocks missing or invalid test-recipient configuration, and asserts immediately
before `sendMail` that no non-test recipient is present.

## Current implementation status

Implemented:

- Mail section in Settings.
- SMTP host, port, security protocol, authentication type, username, password status, from address, from name and reply-to address.
- MAIL TEST moved under the Mail section.
- A `Testmail versturen` action sends one translated, centrally styled test message to the stored `MAIL_TEST_RECIPIENT` through the stored SMTP configuration.
- The test button is unavailable while settings are incomplete, unsaved or another mail-settings action is running.
- API validation for email addresses, SMTP port, auth mode and production confirmation.
- Settings stored in `AppSetting` without a schema migration.
- SMTP transport dependency and central send service in `lib/server/mail-service.ts`.
- Central mail templates in `lib/server/mail-templates.ts`.
- Workflow e-mail for Hulpaanvragen, visible/shared Contactmomenten and Begeleiding approval requests, sent best-effort after the workflow or in-app notification transaction succeeds.
- Begeleiding approval mail goes to the coached person and replies to the user who submitted the Begeleiding for approval.
- SMTP delivery was confirmed by the user on 2026-07-13.
- MAIL TEST routing is applied by the central service: real to/cc/bcc/envelope recipients are replaced by the configured test recipient while the original route is logged as metadata and as a testmail warning.
- MAIL TEST delivery is fail-safe: missing or invalid test-recipient configuration blocks sending instead of using the original recipients or a hardcoded fallback.
- Delivery logging is limited to event key, recipient user, route metadata, status and error text; the mail body is not written to the delivery log.
- Regression test: `npm run test:mail-test-settings`.
- Regression test: `npm run test:mail-service`.
- Regression test: `npm run test:mail-settings-action`.
- Regression test: `npm run test:coaching-approval-mail`.

Still open:

- Wire Professional/Expert and reminder e-mail after the lifecycle/background-job contract is defined.

## Controlled SMTP smoke test

The reusable smoke test sends exactly one message through the central mail service,
requires MAIL TEST to be forced and locked, verifies the configured test recipient
and checks the persisted delivery log. It refuses a production deployment and
stops before SMTP when required settings are incomplete.

Run it only after explicit approval:

```powershell
$env:MAIL_TEST_SMOKE_CONFIRM="MAIL_TEST_SMOKE_SEND"
npm run mail:test:smoke
Remove-Item Env:MAIL_TEST_SMOKE_CONFIRM
```
