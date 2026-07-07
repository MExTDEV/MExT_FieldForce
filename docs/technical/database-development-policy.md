# Database development policy

From this phase onward, every functional change must include a database impact check.

## Checklist

- New entity or table?
- New field?
- New relation or foreign key?
- New index for filtering, reporting or joins?
- Prisma migration required?
- Seed or configuration data required?
- Existing query, server action or API route affected?
- Existing records require a safe backfill?
- Audit log required?

## Rules

- No credentials in source code.
- No destructive database changes outside migrations.
- No production seed that overwrites business data.
- Production application code must not import `lib/mock-data.ts`.
- Browser storage may contain only UI preferences, recoverable drafts and retry metadata. MariaDB remains the source of truth.
- Prefer additive migrations. Destructive changes need an explicit data migration plan.
- Server-side authorization must match or exceed client-side visibility rules.
- New write paths must handle database errors without breaking the full app shell.
