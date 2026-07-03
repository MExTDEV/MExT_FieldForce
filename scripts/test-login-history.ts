import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";
import {
  closeLoginSession,
  listUserLoginSessions,
  recordSuccessfulLogin,
  touchLoginSession,
  withLoginRequestContext,
} from "@/lib/server/login-history";

async function main() {
const user = await prisma.user.findFirst({
  where: { active: true },
  select: { id: true, email: true, lastLoginAt: true },
});
assert(user, "Voor de integratietest is minstens één actieve gebruiker nodig.");

const marker = `login-audit-test-${randomUUID()}`;
let sessionId: string | undefined;

try {
  const stored = await withLoginRequestContext(
    new Request("http://fieldforce.test/api/auth/callback/credentials", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
      },
    }),
    () => recordSuccessfulLogin({
      provider: "credentials",
      userId: user.id,
      userEmail: user.email,
      sessionId: marker,
    })
  );
  sessionId = stored.sessionId;
  assert.equal(sessionId, marker);

  const active = await listUserLoginSessions({
    userId: user.id,
    provider: "credentials",
    browser: "Chrome",
    ipAddress: "203.0.113",
    deviceType: "Desktop",
    status: "active",
    page: 1,
  });
  const created = active.sessions.find((session) => session.sessionId === marker);
  assert(created, "De nieuwe login moet via de gebruikersquery terugkomen.");
  assert.equal(created.operatingSystem, "Windows");
  assert.equal(created.status, "active");

  assert.equal(await touchLoginSession(marker), true);
  assert.equal(await closeLoginSession(marker), true);
  const loggedOut = await listUserLoginSessions({
    userId: user.id,
    status: "logged-out",
    page: 1,
  });
  assert(loggedOut.sessions.some((session) => session.sessionId === marker));

  console.log(JSON.stringify({
    created: true,
    queryFilters: true,
    activity: true,
    logout: true,
    cleanup: true,
  }));
} finally {
  if (sessionId) {
    await prisma.userLoginSession.deleteMany({ where: { sessionId } });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: user.lastLoginAt },
  });
  await prisma.$disconnect();
}
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
