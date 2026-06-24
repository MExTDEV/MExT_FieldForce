# Microsoft Entra ID authentication

MExT FieldForce uses Auth.js with the Microsoft Entra ID provider. Production
authentication is enabled with `NEXT_PUBLIC_AUTH_MODE="entra"`.

## 1. Register the application

1. Open Microsoft Entra admin center.
2. Go to **Identity > Applications > App registrations**.
3. Create a new single-tenant registration for MExT FieldForce.
4. Copy the **Application (client) ID** and **Directory (tenant) ID**.
5. Under **Certificates & secrets**, create a client secret and store its value
   immediately in the approved password manager.

No extra Microsoft Graph application permissions are required for basic login.
The standard OpenID Connect scopes provide the identity claims.

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
NEXT_PUBLIC_AUTH_MODE="entra"
APP_URL="https://your-fieldforce-domain.example"
AUTH_URL="https://your-fieldforce-domain.example"
AUTH_SECRET="at-least-32-random-characters"
AUTH_MICROSOFT_ENTRA_ID_ID="application-client-id"
AUTH_MICROSOFT_ENTRA_ID_SECRET="application-client-secret"
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/tenant-id/v2.0"
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

## 5. Local development

Use demo mode when Entra is not needed:

```env
NEXT_PUBLIC_AUTH_MODE="demo"
```

Demo mode keeps the development user switcher. It must not be used on a public
production environment.

## 6. Production verification

1. Run `npm run deploy:prepare`.
2. Restart the Node.js application in Plesk.
3. Open `/login` and sign in with a registered Entra user.
4. Confirm that `User.entraId` is populated in MariaDB.
5. Test a representative, sales leader, country manager and administrator.
6. Confirm each role only sees and changes records within its allowed scope.

Rotate expired client secrets in Entra and Plesk together. Keep the old secret
active until the application has been restarted and the new login is verified.
