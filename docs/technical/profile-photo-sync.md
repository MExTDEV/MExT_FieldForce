# Microsoft profile photo sync

Date: 2026-07-14

## Purpose

FieldForce does not let browsers load Microsoft Graph profile-photo URLs. User
avatars are downloaded server-side, stored under the private upload root and
served through the authenticated FieldForce avatar route.

## Microsoft Graph

Endpoint:

```text
GET https://graph.microsoft.com/v1.0/users/{entraObjectId-or-userPrincipalName}/photo/$value
```

Authentication uses application client credentials with:

```text
scope=https://graph.microsoft.com/.default
```

The Entra app registration must have the application permission
`ProfilePhoto.Read.All` with admin consent. Do not add broader permissions when
this permission is sufficient. Existing delegated Outlook scopes remain separate
and are not used for the nightly photo job.

## Environment

Required for app-only Graph access:

```env
AUTH_MICROSOFT_ENTRA_ID_ID="application-client-id"
AUTH_MICROSOFT_ENTRA_ID_SECRET="application-client-secret"
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/tenant-id/v2.0"
```

Optional explicit tenant override:

```env
AUTH_MICROSOFT_ENTRA_TENANT_ID="tenant-id"
```

Storage and throttling:

```env
FIELD_FORCE_UPLOAD_ROOT="storage/uploads"
PROFILE_PHOTO_SYNC_CONCURRENCY="4"
```

`PROFILE_PHOTO_SYNC_CONCURRENCY` is capped by application code and defaults to
4. Production should keep `FIELD_FORCE_UPLOAD_ROOT` outside transient build
output and include `user-avatars/` in backups.

## Database fields

Migration `0033_user_profile_photo_sync` adds these fields to `User`:

- `profilePhotoStorageKey`
- `profilePhotoMimeType`
- `profilePhotoHash`
- `profilePhotoSyncedAt`
- `profilePhotoSyncStatus`: `SYNCED`, `NO_PHOTO`, `SKIPPED`, `ERROR`
- `profilePhotoSyncError`

It also adds `ProfilePhotoSyncRun` for job locking, history, summary counts and
technical error summaries. At most one `QUEUED` or `RUNNING` profile-photo sync
run may exist in normal operation; later starts return the active run.

## Behaviour

The sync uses `User.entraId` first. If it is missing, it falls back to
`User.microsoftEmail` and then the stored business e-mail address.

For each user:

- `200` with a valid JPEG, PNG or WebP stores the image atomically below
  `FIELD_FORCE_UPLOAD_ROOT/user-avatars/<userId>/`;
- identical image hashes update only `profilePhotoSyncedAt`;
- changed hashes replace the local file and update `avatarUrl` with a hash
  version query string;
- `404` deletes the local avatar file, clears metadata, sets `NO_PHOTO` and the
  UI falls back to initials;
- `401`, `403`, `429`, `5xx`, network timeouts and invalid image responses keep
  any existing local image and mark the user `ERROR`.

Graph requests are bounded by `PROFILE_PHOTO_SYNC_CONCURRENCY`. Temporary
responses retry up to three attempts and `429` respects `Retry-After`.

## Manual sync

`Beheer -> Instellingen -> Microsoft-account` exposes
`Microsoft-profielfoto's synchroniseren` to users with access to the existing
settings management section. The button starts the same sync routine and polls
`ProfilePhotoSyncRun`; the HTTP request does not wait for the full Graph run.

## Nightly sync

Configure a Plesk Scheduled Task:

```text
Command: npm run profile-photos:sync
Schedule: 0 1 * * *
Timezone: Europe/Brussels
Working directory: FieldForce application root
```

The timezone must be Europe/Brussels so daylight saving time is handled by the
scheduler. The application command is idempotent and skips duplicate active
runs.

## Logs

Each run writes `ProfilePhotoSyncRun` and a best-effort `AuditLog` entry with
summary counts. Per-user errors are stored without tokens, secrets, binary data
or full Graph responses. Ordinary users only see the summary in settings;
technical details are available through the database-backed run records and the
server log.
