# Deployment

This document describes the deployment principles for MExT FieldForce.

The purpose of this document is to guide AI assistants and developers when preparing, validating or troubleshooting deployment-related work.

This document does not contain secrets, passwords, connection strings or production credentials.

---

# Scope

This document covers:

- local development startup checks
- build validation
- Git workflow before deployment
- VPS / Plesk deployment principles
- Prisma and database migration deployment
- environment configuration principles
- webserver validation
- troubleshooting rules

Detailed server-specific documentation may exist in:

- `docs/technical/vps-deployment.md`
- `docs/technical/database-development-policy.md`
- `docs/technical/mariadb-migration-roadmap.md`

When detailed technical documentation exists, it is the source of truth.

---

# Deployment Principles

Deployment must be treated as a controlled process.

A change is not considered finished when code has been modified.

A change is only finished when:

- the requested functionality works;
- visual validation is completed;
- functional validation is completed;
- role and permission behaviour is checked;
- database changes are migrated correctly;
- documentation is updated when needed;
- the application starts correctly after deployment.

---

# Environments

## Local Development

Local development is used to build, test and validate changes before they are merged or deployed.

Expected local validation:

- install dependencies when needed;
- generate Prisma client when needed;
- run database migration commands only when required;
- start the webserver;
- verify the application is reachable;
- verify the changed workflow manually.

The application should normally run on:

- `localhost:3000`

If port 3000 is not available, the server may temporarily run on another port, but this must be considered a development exception.

The preferred target for validation remains port 3000.

---

## Production / VPS

Production runs on the MExT VPS environment through Plesk and Node.js.

Production deployment must respect the existing hosting configuration.

AI assistants must not invent or modify production server settings unless explicitly requested.

Before changing production deployment behaviour, verify the existing technical documentation and Plesk configuration.

---

# Git Workflow

Current workflow:

- changes are validated locally;
- once approved, changes are merged into the main branch;
- changes are pushed to Git.

Current limitation:

- the project currently does not use a mature branch-based workflow.

Future improvement:

- introduce feature branches when the team is ready;
- validate changes before merging into main;
- reduce risk of breaking the main branch.

AI rule:

Do not introduce a new Git workflow without explicit approval.

---

# Pre-Deployment Checklist

Before deployment or merge, verify:

## Functional

- The requested change is implemented.
- The original request has not been replaced by an alternative implementation.
- Existing workflows still work.
- Related workflows are not broken.

## Visual

- Existing MExT FieldForce look-and-feel is preserved.
- Layout is responsive.
- Tablet usage remains practical.
- Buttons, cards, tables and badges follow existing UI conventions.

## Permissions

- Menu visibility respects role configuration.
- User-level overrides are respected.
- Scope rules are respected:
  - country
  - team
  - user
- No permissions are broadened without explicit request.

## Database

- Prisma schema changes are intentional.
- Migrations are created when required.
- Prisma Client is regenerated when required.
- Production schema is not modified manually.
- Existing data is reused whenever possible.

## Build

Run when possible:

```bash
npm run lint
npm run build
```

If these commands fail, deployment should stop until the issue is understood and fixed.

---

# Prisma and Database Deployment

The application uses Prisma on top of MariaDB / MySQL.

Database deployment rules:

- never manually modify the production database schema;
- use Prisma migrations for structural changes;
- keep migration history consistent;
- do not create duplicate tables or fields when existing data can be reused;
- document new business-critical fields;
- document all business calculations.

Before production deployment involving database changes:

1. Review Prisma schema changes.
2. Review migration files.
3. Confirm no destructive migration is introduced unintentionally.
4. Run the correct deployment migration command according to the technical documentation.
5. Regenerate Prisma Client if required.
6. Validate affected screens after deployment.

Reference:

- `docs/technical/database-development-policy.md`
- `docs/technical/database.md`

---

# Environment Variables

Environment variables are required for runtime configuration.

Examples may include:

- database connection;
- authentication configuration;
- Microsoft / Entra ID integration;
- application URLs;
- API secrets.

Rules:

- never commit real secrets to Git;
- never expose `.env` values in documentation;
- never print production secrets in logs;
- document the purpose of required variables without documenting secret values;
- use placeholder names in documentation.

If an environment variable is missing or incorrect, the application may fail at startup or authentication may break.

---

# Microsoft Authentication

MExT FieldForce should use Microsoft Entra ID authentication wherever possible.

Deployment must preserve:

- Microsoft login;
- automatic sign-in where available;
- role mapping;
- user identity resolution;
- session behaviour.

AI assistants must not replace Microsoft login with a separate login flow unless explicitly requested.

---

# Webserver Validation

After deployment or after Codex has modified the application, the webserver must be checked.

Required validation:

- verify that the application starts;
- verify that it responds on the expected port;
- verify that the login page loads;
- verify that an authenticated user can reach the Dashboard.

Preferred development port:

- `3000`

If the webserver is not running on port 3000:

1. Check whether another process is using port 3000.
2. Stop the wrong process if appropriate.
3. Restart the development server.
4. Confirm the application is reachable on port 3000.
5. If another port is used temporarily, note this clearly.

AI rule:

When a task includes deployment or server restart instructions, always verify the application is actually reachable after restart.

---

# Plesk Deployment Notes

Production deployment is managed through Plesk.

AI assistants must treat Plesk configuration as environment-specific.

Do not assume:

- exact Node.js version;
- exact startup file;
- exact document root;
- exact application mode;
- exact Passenger configuration;
- exact environment variable location.

These must be verified in Plesk or in the technical deployment documentation.

If deployment fails in Plesk, check:

- Node.js application status;
- startup file;
- application root;
- environment variables;
- database connection;
- build output;
- server logs;
- Passenger / Node startup errors.

Reference:

- `docs/technical/vps-deployment.md`

---

# Logging and Troubleshooting

When troubleshooting deployment problems:

1. Identify the environment.
2. Check whether the issue is local or production.
3. Check whether the application builds.
4. Check whether the application starts.
5. Check whether environment variables are present.
6. Check database connectivity.
7. Check authentication configuration.
8. Check logs.
9. Avoid random fixes.

Common deployment failure categories:

- missing environment variable;
- Prisma Client not generated;
- pending migration;
- build failure;
- wrong startup file;
- wrong port;
- authentication configuration issue;
- database connection issue;
- Node/Plesk startup issue.

---

# Deployment Documentation Rules

When deployment behaviour changes, update this document.

When production-specific technical details change, update:

- `docs/technical/vps-deployment.md`

When database deployment rules change, update:

- `docs/technical/database-development-policy.md`

When new environment variables are introduced:

- document their purpose;
- document where they are required;
- never document their secret values.

---

# AI Deployment Rules

AI assistants must:

- read `AGENTS.md` before deployment-related work;
- read `docs/ai/INDEX.md`;
- read this deployment document;
- read technical deployment documentation when production is involved;
- avoid assumptions about server configuration;
- never expose secrets;
- never broaden permissions;
- preserve Microsoft authentication;
- validate build when possible;
- validate the application starts;
- document unresolved deployment risks.

AI assistants must not:

- invent production configuration;
- change database schema manually;
- commit secrets;
- replace Microsoft authentication;
- ignore failed builds;
- claim deployment succeeded without validation.

---

# Open Questions

The following details should be confirmed and documented in the technical deployment documentation:

- exact production Node.js version;
- exact Plesk startup command or startup file;
- exact build output location;
- exact deployment path;
- whether production uses SSR, standalone Next.js output or another runtime mode;
- whether deployment is manual or automated;
- whether server restart is manual or automatic;
- how logs are accessed in Plesk;
- how environment variables are managed in production.

These open questions must not block this AI-level deployment guide, but they should be resolved before relying on automated deployment prompts.
