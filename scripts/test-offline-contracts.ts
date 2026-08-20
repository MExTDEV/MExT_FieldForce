import assert from "node:assert/strict";
import fs from "node:fs";

const contracts = fs.readFileSync("modules/contracts/index.ts", "utf8");

for (const token of [
  "SourceSystem",
  "SyncState",
  "OfflineRecord",
  "OfflineMutation",
  "SyncReceipt",
  "SyncConflict",
  "OfflineDataPolicy",
  "ErpAdapterPort",
  "BUSINESS_CENTRAL_140",
  "ODOO",
]) {
  assert(contracts.includes(token), `Offline contract ontbreekt: ${token}`);
}

assert(
  contracts.includes('sourceSystem: "FIELD_FORCE"'),
  "Lokale mutaties moeten als FieldForce-bron worden gemarkeerd."
);
assert(
  contracts.includes("requiresRemoteConfirmation"),
  "Offline beleid moet remote bevestiging kunnen afdwingen."
);
assert(
  !/^\s*import\s/m.test(contracts),
  "Offline contractlaag mag geen runtime-imports bevatten."
);

console.log("Offline-first contracten: ERP-bronnen, outbox, receipts, conflicten en freshness gevalideerd.");
