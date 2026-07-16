# Milestone 1 — Encrypted offline device store

Status: `FOUNDATION IMPLEMENTED IN SOURCE — RUNTIME INTEGRATION PENDING`

This slice provides the isolated browser-storage foundation for recoverable SalesDay drafts and later offline commands. MariaDB and the ERP remain the authoritative business-data path; IndexedDB is not a second system of record.

## Implemented

- AES-256-GCM encryption with a fresh 96-bit IV per write and authenticated envelope metadata;
- a non-extractable `CryptoKey` boundary: the store accepts a provisioned key but never persists raw key material;
- user/device binding through a SHA-256 binding value included in the authenticated metadata, without storing readable user or device identifiers in each record;
- versioned payload migrations that rewrite a successfully migrated record using the current payload version;
- explicit handling for missing, unsupported, binding-mismatched and corrupt records;
- atomic IndexedDB quarantine-and-remove behaviour for corrupt records;
- metadata-only quarantine: unknown or corrupt payload content is never copied into the quarantine store;
- namespace-level removal and a full driver wipe primitive for later logout, revocation and remote-wipe integration;
- a native IndexedDB driver with separate active-record and quarantine object stores.

Source:

- `lib/device/encrypted-store.ts`
- `lib/device/indexeddb-driver.ts`
- `scripts/test-encrypted-device-store.ts`

## Validated

`npm run test:encrypted-device-store` covers:

- ciphertext does not expose the draft, user ID or device ID;
- correct-key read/write;
- device/user mismatch without destructive quarantine;
- required and successful sequential payload migration;
- tampered ciphertext quarantine and removal;
- clearing active records and quarantine metadata through the wipe primitive.

TypeScript and targeted ESLint validation are part of this slice's acceptance checks.

## Still open

This source foundation is not yet a production offline implementation. The following remain mandatory:

- secure key provisioning and key revocation for the server-backed `DeviceRegistration` described in `MILESTONE-1-DEVICE-REGISTRATION.md`;
- Android/MDM binding, remote session invalidation and a remote-wipe endpoint;
- biometric/PIN resume gate;
- wiring SalesDay drafts and the command outbox to this store;
- continuous autosave, sync status, retry and day −1 blocking UI;
- a controlled migration or expiry path for any existing local-storage drafts;
- real-browser IndexedDB, storage-pressure, upgrade, logout and device-loss acceptance tests.

No production feature may derive or hardcode the encryption key from a user ID, device ID, password or other predictable application value.
