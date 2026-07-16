# Milestone 1 — SalesDay device registration

Status: `IMPLEMENTED IN SOURCE — PRODUCTION DEPLOYMENT PENDING`

This slice establishes the server-side identity and lifecycle for a Representative's personal SalesDay device. Key provisioning and remote control are implemented separately in `MILESTONE-1-DEVICE-SECURITY.md`; an actual MDM provider remains pending.

## Persistence

Migration `0042_salesday_device_registration` additively creates `DeviceRegistration` with:

- an opaque, application-generated `deviceId` that is unique across FieldForce;
- the owning FieldForce user and the current platform (`WINDOWS` or `ANDROID`);
- version and display metadata required for support and policy checks;
- registration, last-seen and revocation timestamps;
- revoking actor and mandatory reason;
- status `ACTIVE` or `REVOKED`;
- nullable unique `activeUserKey`, used to enforce at database level that a user has at most one active SalesDay device while retaining revoked history.

The migration is additive and has not been deployed to the configured production database.

## Lifecycle rules

- only a Representative can self-register a personal SalesDay device;
- registering the same active device again refreshes its safe metadata and heartbeat;
- a device ID can never move to another user;
- a revoked device ID can never be reactivated;
- a second device is rejected while the user still has an active registration;
- controlled replacement requires revoking the previous registration and registering a new device identity;
- heartbeat is accepted only from the owning Representative and an active registration;
- revocation requires the explicit `salesday.manage` permission, effective country scope and a reason;
- revocation is idempotent and retains the historical registration.

The replacement rule deliberately prevents unacknowledged offline command identity from silently moving between devices.

## API and audit

- `GET/POST /api/salesday/devices`
- `POST /api/salesday/devices/{deviceId}/heartbeat`
- `POST /api/salesday/devices/{deviceId}/revoke`

Registration and revocation write the shared FieldForce audit log. Internal database constraint fields are not returned by the API.

## Validation

`npm run test:salesday-device-registration` covers owner binding, metadata refresh, duplicate-device protection, one-active-device enforcement, role and country scope, revocation, replacement, permission defaults and additive migration structure.

Additional validation:

- `npx prisma validate`;
- `npm run typecheck`;
- targeted ESLint.

Normal Prisma client generation was blocked by the query-engine DLL held by the managed local development process. `npx prisma generate --no-engine` successfully generated and validated the client types without stopping that process.

## Still open

- PWA runtime integration of the device-key and remote-control source foundation;
- device compliance/MDM provider integration and supported-OS policy;
- binding an online login session and offline bootstrap to the active registration;
- production migration deployment and real-device acceptance.
