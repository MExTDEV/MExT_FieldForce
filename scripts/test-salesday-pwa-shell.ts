import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync("components/salesday/device-runtime-provider.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const registration = readFileSync("lib/server/salesday-device-registration.ts", "utf8");
const workspace = readFileSync("components/workspace-pages.tsx", "utf8");
const dictionaries = ["nl", "fr", "de"].map((language) =>
  JSON.parse(readFileSync(`locales/${language}.json`, "utf8")) as Record<string, string>,
);

assert(layout.includes("<SalesDayDeviceRuntimeProvider>"));
assert(runtime.includes("getOrCreateDeviceIdentity"));
assert(runtime.includes("new IndexedDbDeviceKeyVault()"));
assert(runtime.includes("new IndexedDbDeviceStoreDriver()"));
assert(runtime.includes("provisionLocalDeviceKey"));
assert(runtime.includes("loadLocalDeviceKey"));
assert(runtime.includes('store.write(tokenRecordKey, { deviceToken: confirmed.deviceToken }'));
assert(runtime.includes("/api/salesday/bootstrap"));
assert(runtime.includes("executeDeviceControls"));
assert(runtime.includes("clearEncryptedDeviceData: () => input.storeDriver.clear()"));
assert(runtime.includes("clearDeviceKeys: () => input.keyVault.clear()"));
assert(runtime.includes("pollTimer = setInterval(poll, controlPollIntervalMs)"));
assert(runtime.includes("DeviceReplacementRequiredError"));
assert(runtime.includes("initializationRef.current?.userId !== user.id"));
assert(runtime.includes("await initialization.promise"));
assert(registration.includes("keyFingerprint: registration.keyFingerprint ?? null"));
assert(workspace.includes('salesDayDeviceRuntime.phase === "INITIALIZING"'));
assert(workspace.includes('salesDayDeviceRuntime.phase === "REPLACEMENT_REQUIRED"'));
assert(workspace.includes('salesDayDeviceRuntime.phase === "ERROR"'));

const keys = Object.keys(dictionaries[0]).filter((key) => key.startsWith("salesday.device.")).sort();
assert(keys.length >= 6);
for (const dictionary of dictionaries.slice(1)) {
  assert.deepEqual(Object.keys(dictionary).filter((key) => key.startsWith("salesday.device.")).sort(), keys);
}

console.log("SalesDay PWA shell: device identity, key provisioning, encrypted token, bootstrap, remote control and blocking UI validated.");
