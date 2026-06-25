# VPS deployment with Plesk

This runbook deploys MExT FieldForce as a Node.js application with MariaDB/MySQL.

## Authentication modes

Use the demo user selector only on a private, IP-restricted local or staging
environment:

```env
DEPLOYMENT_ENV="staging"
NEXT_PUBLIC_AUTH_MODE="demo"
```

Public production must use Microsoft Entra ID:

```env
DEPLOYMENT_ENV="production"
NEXT_PUBLIC_AUTH_MODE="entra"
```

See `docs/entra-authentication.md` for the Entra app registration and callback
URLs. Do not expose demo mode publicly.

## Rotate the exposed database password

1. In Plesk, open **Databases**.
2. Open the database user used by FieldForce.
3. Generate a new unique password and store it in the approved password manager.
4. Save the database user.
5. Update `DATABASE_URL` in the local `.env` and the Plesk Node.js environment.
6. Run `npm run env:check:production` and `npm run db:migrate:status`.
7. Restart the app and verify `/api/health`.

Do not place the password in source code, documentation, screenshots or Git.
URL-encode reserved characters in the password inside `DATABASE_URL`.

## Plesk Node.js application

Recommended settings:

- Node.js: supported LTS, Node.js 20 or 22
- Application mode: `production`
- Application root: the checked-out FieldForce repository
- Document root: `public`
- Application startup file: `server.mjs`
- Reverse proxy: enabled
- SSL/TLS: enabled with a valid certificate

Set these environment variables in Plesk:

```env
NODE_ENV="production"
DEPLOYMENT_ENV="production"
APP_URL="https://fieldforce.example.com"
AUTH_URL="https://fieldforce.example.com"
PORT="3000"
DATABASE_URL="mysql://database-user:url-encoded-password@database-host:3306/database-name"
SEED_ALLOW_DESTRUCTIVE="false"
AUTH_SECRET="at-least-32-random-characters"
NEXT_PUBLIC_AUTH_MODE="entra"
AUTH_MICROSOFT_ENTRA_ID_ID="application-client-id"
AUTH_MICROSOFT_ENTRA_ID_SECRET="application-client-secret"
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/tenant-id/v2.0"
```

Keep all secrets in Plesk environment variables or the approved secret store,
never in the repository.

For the current deployment both URL values must be:

```env
APP_URL="https://fieldforce.mext.group"
AUTH_URL="https://fieldforce.mext.group"
```

Auth.js uses secure, HTTP-only cookies on HTTPS with the default `SameSite=Lax`
policy and path `/`. Do not configure a cookie domain manually; host-only
cookies prevent accidental sharing with other `mext.group` applications.

## Deployment

Before deploying:

- Confirm a recent database backup exists.
- Stop or place the application in maintenance mode before replacing dependencies.
- Never run `db:seed:dev` on the VPS.

First deployment:

```bash
npm ci
npm run deploy:prepare
```

For a manual Plesk build, this is sufficient:

```bash
npm install
npm run build
```

The `prebuild` lifecycle automatically runs `prisma generate`, so Next.js never
builds against a stale Prisma Client.

In Plesk, click **Enable Node.js** or **Restart App** after
`deploy:prepare` succeeds. Plesk starts `server.mjs`.

Subsequent deployments:

```bash
git pull --ff-only
npm ci
npm run deploy:prepare
```

Restart the Node.js app in Plesk after preparation succeeds.

`deploy:prepare` validates the environment, generates Prisma, deploys pending
migrations, runs the non-destructive configuration seed and builds Next.js.
It never runs the destructive development seed.

## Verification

```bash
npm run db:migrate:status
npm run health:check
```

External monitoring can call `GET /api/health` over HTTPS. The endpoint exposes
no credentials, SQL details or personal data.

## Rollback and backups

- Never reverse schema changes by manually deleting tables or columns.
- Restore the previous application release when a code deployment fails.
- Correct schemas with a new forward migration.
- Enable daily MariaDB backups in Plesk and retain at least seven restore points.
- Test restores on a non-production database.
- Take an on-demand backup before a material data transformation.
