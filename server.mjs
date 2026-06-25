import http from "node:http";
import next from "next";

validateProductionEnvironment();

const hostname = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    http.createServer((request, response) => {
      handle(request, response);
    }).listen(port, hostname, () => {
      console.log(`MExT FieldForce listening on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("[startup] FieldForce could not start.", error);
    process.exit(1);
  });

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  const required = [
    "DATABASE_URL",
    "APP_URL",
    "AUTH_URL",
    "AUTH_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_ID",
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_ISSUER",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  for (const name of ["APP_URL", "AUTH_URL"]) {
    const url = new URL(process.env[name]);
    if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw new Error(`${name} must be a public HTTPS URL in production.`);
    }
  }
  if (process.env.APP_URL !== process.env.AUTH_URL) {
    throw new Error("APP_URL and AUTH_URL must be identical.");
  }
}
