# Microsoft Entra ID authentication

Microsoft Entra ID is optional. FieldForce continues to support secure
database login with e-mail and password when Entra is absent or temporarily
unavailable.

MExT FieldForce uses Auth.js with the Microsoft Entra ID provider as an
optional second login method. Database authentication remains active.

## 1. Register the application

1. Open Microsoft Entra admin center.
2. Go to **Identity > Applications > App registrations**.
3. Create a new single-tenant registration for MExT FieldForce.
4. Copy the **Application (client) ID** and **Directory (tenant) ID**.
5. Under **Certificates & secrets**, create a client secret and store its value
   immediately in the approved password manager.

No extra Microsoft Graph application permissions are required for basic login.
The standard OpenID Connect scopes provide the identity claims. Server-side
Microsoft profile photo synchronisation is separate from login and requires the
application permission `ProfilePhoto.Read.All` with admin consent when enabled.

## 2. Configure redirect URLs

Add these Web redirect URIs:

```text
http://localhost:3000/api/auth/callback/microsoft-entra-id
https://your-fieldforce-domain.example/api/auth/callback/microsoft-entra-id
```

Replace the production hostname with the real HTTPS domain. Redirect URLs must
match exactly, including protocol, hostname, port and path.

## 3. Configure environment variables

Local `.env`:

```env
NEXT_PUBLIC_AUTH_MODE="credentials"
APP_URL="https://your-fieldforce-domain.example"
AUTH_URL="https://your-fieldforce-domain.example"
AUTH_SECRET="at-least-32-random-characters"
AUTH_MICROSOFT_ENTRA_ID_ID="application-client-id"
AUTH_MICROSOFT_ENTRA_ID_SECRET="application-client-secret"
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/tenant-id/v2.0"
AUTH_MICROSOFT_ENTRA_TENANT_ID="tenant-id"
```

Use the same names in Plesk. Never commit real values. Generate `AUTH_SECRET`
with a cryptographically secure password generator.

Validate production configuration with:

```bash
npm run env:check:production
```

## 4. Prepare FieldForce users

Every person must already exist as an active user in MariaDB. The database
e-mail address must equal the primary e-mail returned by Entra.

On first successful login:

1. FieldForce finds the active user by e-mail address.
2. It stores the immutable Entra object ID in `User.entraId`.
3. Later logins require the same Entra object ID.

FieldForce never auto-provisions a new database user. Inactive, unknown or
mismatched accounts are refused.

## Server-side Microsoft tokens

FieldForce bewaart uitsluitend een compacte gebruikersidentiteit in de
versleutelde Auth.js-sessiecookie. Microsoft `access_token`, `refresh_token` en
`id_token` worden nooit naar de browsersessie gekopieerd.

De gedelegeerde Graph-tokens worden server-side, AES-256-GCM versleuteld,
opgeslagen in `MicrosoftAuthToken`. De versleutelingssleutel wordt afgeleid van
`AUTH_SECRET`. Wijzig `AUTH_SECRET` daarom niet zonder dat alle gebruikers
opnieuw met Microsoft kunnen aanmelden.

Na deployment van deze wijziging:

1. Voer `npx prisma migrate deploy` uit.
2. Herstart de Node.js-app in Plesk.
3. Wis eenmalig de bestaande Auth.js-cookies voor het productiedomein.
4. Meld opnieuw aan met Microsoft om de server-side Graph-tokenopslag te vullen.

Met `AUTH_SESSION_DEBUG=true` kan staging uitsluitend veldnamen en geschatte
payloadgroottes loggen. Tokenwaarden en andere secrets worden nooit gelogd.

When Microsoft returns a different verified sign-in address than the business
mailbox, register that exact address in `UserLoginAlias`. Aliases are explicit
database records; FieldForce never matches users by partial address or domain.

## Server-side profile photos

Microsoft profile photos are downloaded by the server through
`GET /users/{entraObjectId-or-userPrincipalName}/photo/$value`, stored under the
private upload root and served through `/api/users/<userId>/avatar`. See
`docs/technical/profile-photo-sync.md` for permissions, retry behaviour,
metadata, manual sync and the nightly Plesk command.

## 5. Local development

Use demo mode when Entra is not needed:

```env
NEXT_PUBLIC_AUTH_MODE="demo"
```

Demo mode keeps the development user switcher. It must not be used on a public
production environment.

## Impersonation and the authenticated identity

Impersonation never changes `User.entraId`, Microsoft tokens or the Auth.js
database user ID. The real Auth.js login remains linked to a validated
`UserLoginSession`; a separate database record supplies the effective
FieldForce user for at most one hour.

Start and stop are same-origin POST requests. No impersonation token or target
ID is stored in a URL or browser storage. Every backend authentication check
revalidates the real user's `users.impersonate` right and the target's active
state. Logout closes the impersonation before the login session is considered
finished.

MAIL TEST continues to replace all provider recipients. When mail is generated
during impersonation, the MAIL TEST warning additionally identifies both the
real and effective user and the impersonation session. Personal notifications
of the effective user remain read-only during impersonation.

## 6. Production verification

1. Run `npm run deploy:prepare`.
2. Restart the Node.js application in Plesk.
3. Open `/login` and verify both database login and Entra login.
4. Confirm that `User.entraId` is populated in MariaDB.
5. Test a representative, sales leader, country manager and administrator.
6. Confirm each role only sees and changes records within its allowed scope.

Rotate expired client secrets in Entra and Plesk together. Keep the old secret
active until the application has been restarted and the new login is verified.
