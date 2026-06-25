import { prisma } from "../lib/server/db";
import { hashPassword } from "../lib/server/password";

async function main() {
  const email = process.env.AUTH_PASSWORD_EMAIL?.trim().toLowerCase();
  const password = process.env.AUTH_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Stel AUTH_PASSWORD_EMAIL en AUTH_PASSWORD tijdelijk in voordat je dit script uitvoert."
    );
  }

  const user = await prisma.user.findFirst({
    where: { email, active: true },
    select: { id: true, email: true },
  });
  if (!user) {
    throw new Error(`Geen actieve FieldForce-gebruiker gevonden voor ${email}.`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(password) },
  });

  console.log(`Wachtwoord ingesteld voor ${user.email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
