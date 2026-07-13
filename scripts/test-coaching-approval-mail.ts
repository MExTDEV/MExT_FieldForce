import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const transitionRoute = readFileSync(
  join(
    root,
    "app",
    "api",
    "workflows",
    "coaching",
    "[id]",
    "transition",
    "route.ts"
  ),
  "utf8"
);
const mailService = readFileSync(
  join(root, "lib", "server", "mail-service.ts"),
  "utf8"
);

assert.match(transitionRoute, /type: "COACHING_APPROVAL_REQUEST"/);
assert.match(
  transitionRoute,
  /recipientUserId: coaching\.representativeId/,
  "De begeleide gebruiker moet de akkoordmail ontvangen."
);
assert.match(
  transitionRoute,
  /triggeredByUserId: input\.actorId/,
  "De gebruiker die ter akkoord verstuurt moet als oorspronkelijke afzender meegaan."
);
assert.ok(
  transitionRoute.indexOf("await prisma.$transaction") <
    transitionRoute.indexOf("await sendCoachingApprovalMailSafely"),
  "De mail mag pas na de geslaagde workflowtransactie worden verstuurd."
);
assert.match(
  transitionRoute,
  /catch \(error\)[\s\S]*Begeleidingsmail voor akkoord kon niet worden verzonden/,
  "Een mailfout mag de opgeslagen workflowstatus niet terugdraaien."
);
assert.match(
  mailService,
  /select: \{ firstName: true, lastName: true, email: true \}/
);
assert.match(
  mailService,
  /replyToEmail: actor\?\.email/,
  "Workflowmails moeten antwoorden naar het e-mailadres van de handelende gebruiker."
);

console.log(
  "Akkoordmail naar begeleide gebruiker en Reply-To naar oorspronkelijke afzender gevalideerd."
);