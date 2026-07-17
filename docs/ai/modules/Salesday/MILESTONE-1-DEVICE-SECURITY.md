# Milestone 1 — Device key and remote-control security

Status: `IMPLEMENTED AND WIRED IN SOURCE — MDM AND PRODUCTION DEPLOYMENT PENDING`

This slice connects the personal `DeviceRegistration` to a non-exportable local encryption key, the authenticated login session and auditable remote logout/wipe commands.

## Key provisioning

The server does not create, receive or persist the raw AES key.

1. An authenticated Representative starts a short-lived, one-use provisioning challenge for the own active device and current login session.
2. The PWA creates 32 random bytes locally, calculates a SHA-256 fingerprint, imports them as a non-exportable AES-256-GCM `CryptoKey`, zeroes the temporary byte buffer and stores the key in a dedicated IndexedDB key vault.
3. The PWA returns only the fingerprint with the challenge proof.
4. FieldForce consumes the challenge atomically, increments the device key version, stores the fingerprint and binds the current `UserLoginSession` to the device.
5. FieldForce returns a random device bearer token once. Only its SHA-256 hash is stored server-side; the PWA must store the token inside the encrypted device store.

A challenge is bound to device, owner and login session, expires after ten minutes by default and cannot be replayed. Key fingerprints and device-token hashes are database-unique.

## Session invalidation

Non-demo API authentication now validates the persisted `UserLoginSession` on every protected request. A closed, expired or remotely invalidated login session is rejected even when its Auth.js JWT has not yet expired.

Provisioning binds the active login session to the device. A remote `LOGOUT` or `WIPE` closes all active sessions bound to that registration in the same database transaction that creates the control command.

## Remote commands

`DeviceControlCommand` supports:

- `LOGOUT`: close bound sessions and instruct the PWA to return to login;
- `WIPE`: additionally revoke the device registration and local key version, clear encrypted data and keys, acknowledge and then return to login.

Commands move through `PENDING`, `DELIVERED` and `ACKNOWLEDGED`. One open command per device/type is enforced through `pendingKey`, making repeated management requests idempotent.

After session invalidation, the device can only poll and acknowledge control commands with its high-entropy bearer token. The token hash is never accepted for ordinary user APIs. A wipe acknowledgement marks the token revoked; the hash is retained only so a lost acknowledgement response can be retried idempotently. Polling is rejected after revocation.

The device-side processor acknowledges logout commands before a wipe, clears the encrypted record store and key vault before acknowledging the wipe, and logs out last. A failed clear is not acknowledged and can therefore retry.

## Persistence and API

Migration `0043_salesday_device_security` additively defines:

- key version, fingerprint and provisioning/revocation timestamps on `DeviceRegistration`;
- hashed device-token metadata on `DeviceRegistration`;
- `UserLoginSession.deviceRegistrationId`;
- `DeviceKeyProvisioningChallenge`;
- `DeviceControlCommand`.

API routes:

- `POST /api/salesday/devices/{deviceId}/key/challenge`;
- `POST /api/salesday/devices/{deviceId}/key/confirm`;
- `POST /api/salesday/devices/{deviceId}/control`;
- `GET /api/salesday/devices/{deviceId}/commands`;
- `POST /api/salesday/devices/{deviceId}/commands/{commandId}/ack`.

Management control requests require `salesday.manage`, effective country scope and a reason. Provisioning and control requests use the shared audit log.

## Validation

`npm run test:salesday-device-security` covers:

- non-exportable local AES key creation and fingerprint matching;
- removal of a mismatched local key;
- session-bound, expiring and one-use provisioning;
- absence of raw server-side key and device-token storage;
- login-session binding and invalidation;
- idempotent logout/wipe requests, delivery and acknowledgement;
- local data/key clearing order;
- token revocation, rejected polling and retryable acknowledgement;
- additive schema/migration structure.

Typecheck, targeted ESLint and `npx prisma validate` pass. Migration `0043` has not been deployed to production.

## Still open

- biometric/PIN resume gate;
- real Android keystore/MDM compliance, remote-lock and wipe exercise;
- recovery UX for an interrupted provisioning attempt;
- production deployment and real-device acceptance.

The running PWA shell now creates/reuses the opaque personal device identity, performs challenge/key confirmation as a single-flight operation, stores the device bearer token only in the encrypted device store, executes authenticated bootstrap, polls remote commands and blocks SalesDay on initialization, replacement or security failure.
