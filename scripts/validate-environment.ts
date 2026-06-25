import { loadEnvFile } from "node:process";

loadEnvFile();

const productionCheck = process.argv.includes("--production");
const errors: string[] = [];
const warnings: string[] = [];

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} ontbreekt.`);
  return value ?? "";
}

const databaseUrl = required("DATABASE_URL");
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (!["mysql:", "mariadb:"].includes(parsed.protocol)) {
      errors.push("DATABASE_URL moet het mysql- of mariadb-protocol gebruiken.");
    }
    if (!parsed.hostname) errors.push("DATABASE_URL bevat geen databasehost.");
    if (!parsed.username) errors.push("DATABASE_URL bevat geen databasegebruiker.");
    if (!parsed.password || /replace|password/i.test(parsed.password)) {
      errors.push("DATABASE_URL bevat geen geldig productiepaswoord.");
    }
    if (!parsed.pathname || parsed.pathname === "/") {
      errors.push("DATABASE_URL bevat geen databasenaam.");
    }
  } catch {
    errors.push("DATABASE_URL is geen geldige connection URL.");
  }
}

if (process.env.SEED_ALLOW_DESTRUCTIVE === "true") {
  errors.push("SEED_ALLOW_DESTRUCTIVE moet false zijn buiten een expliciete lokale demo-seed.");
}

if (productionCheck) {
  const deploymentEnv = required("DEPLOYMENT_ENV");
  const appUrl = required("APP_URL");
  const authUrl = required("AUTH_URL");
  const authSecret = required("AUTH_SECRET");

  if (!["staging", "production"].includes(deploymentEnv)) {
    errors.push("DEPLOYMENT_ENV moet staging of production zijn voor een VPS-deployment.");
  }
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (deploymentEnv === "production" && parsed.protocol !== "https:") {
        errors.push("APP_URL moet HTTPS gebruiken in productie.");
      }
      if (deploymentEnv === "production" && ["localhost", "127.0.0.1"].includes(parsed.hostname)) {
        errors.push("APP_URL mag in productie niet naar localhost verwijzen.");
      }
    } catch {
      errors.push("APP_URL is geen geldige URL.");
    }
  }
  if (authUrl && authUrl !== appUrl) {
    errors.push("AUTH_URL moet gelijk zijn aan APP_URL.");
  }
  if (authSecret.length < 32 || /replace|change|secret/i.test(authSecret)) {
    errors.push("AUTH_SECRET moet minstens 32 willekeurige tekens bevatten.");
  }
  if (
    deploymentEnv === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_USER_SWITCHER === "true"
  ) {
    errors.push("De demo-gebruikerswisselaar mag niet actief zijn in publieke productie.");
  }
  if (deploymentEnv === "production" && process.env.NEXT_PUBLIC_AUTH_MODE === "demo") {
    errors.push("NEXT_PUBLIC_AUTH_MODE mag niet demo zijn in publieke productie.");
  }
  const entraNames = [
    "AUTH_MICROSOFT_ENTRA_ID_ID",
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
  ];
  const entraValues = entraNames.map((name) => process.env[name]?.trim());
  if (entraValues.some(Boolean) && !entraValues.every(Boolean)) {
    errors.push("Microsoft Entra is onvolledig: stel alle drie Entra-variabelen in of geen enkele.");
  }
  if (entraValues.every(Boolean)) {
    const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!.trim();
    if (issuer && !/^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0\/?$/.test(issuer)) {
      errors.push("AUTH_MICROSOFT_ENTRA_ID_ISSUER heeft geen geldige tenant-specifieke issuer URL.");
    }
  }
  if (
    deploymentEnv === "staging" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_USER_SWITCHER !== "true"
  ) {
    warnings.push("De demo-gebruikerswisselaar staat uit op staging.");
  }
}

for (const warning of warnings) console.warn(`[environment] ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[environment] ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    productionCheck
      ? "Production environment validation passed."
      : "Environment validation passed."
  );
}
