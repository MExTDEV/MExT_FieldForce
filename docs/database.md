# Database setup

MExT FieldForce uses Prisma migrations with MariaDB/MySQL as the central database.

## Local MariaDB/MySQL

Create a database and user:

```sql
CREATE DATABASE mext_fieldforce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mext_user'@'localhost' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON mext_fieldforce.* TO 'mext_user'@'localhost';
FLUSH PRIVILEGES;
```

Create `.env` from `.env.example` and set:

```env
DATABASE_URL="mysql://mext_user:replace-with-a-strong-password@127.0.0.1:3306/mext_fieldforce"
SEED_ALLOW_DESTRUCTIVE="false"
```

## VPS / production

Use a dedicated database user with only the privileges required by the app. Keep credentials in the VPS environment or `.env` file that is not committed.

Production startup flow:

```bash
npm ci
npm run deploy:prepare
npm run start:production
```

`db:seed:config` only upserts technical configuration such as modules, levels, KPI definitions and coaching criteria. It must not delete business data.

The detailed Plesk runbook is in `docs/vps-deployment.md`.

## Development seed

Demo data is destructive and only intended for local development:

```bash
SEED_ALLOW_DESTRUCTIVE=true npm run db:seed:dev
```

Do not run the development seed against production. The script refuses destructive seed mode when `NODE_ENV=production` or when `SEED_ALLOW_DESTRUCTIVE` is not `true`.

## Migrations

Every database model change must be represented by a Prisma migration in `prisma/migrations`.

Local development:

```bash
npm run db:migrate
```

Production/VPS:

```bash
npm run db:migrate:deploy
```

Do not make manual destructive database edits. If existing records must be transformed, add a migration or a reviewed data backfill script.

## Required check for every future feature

Before implementing a feature or change, verify:

- Is a new table needed?
- Is a new field needed?
- Is a new relation or index needed?
- Is a migration needed?
- Is seed/config data needed?
- Do existing queries, server actions or route handlers need updates?
- Do existing records need a safe migration or backfill?
- Is audit logging required for the mutation?
