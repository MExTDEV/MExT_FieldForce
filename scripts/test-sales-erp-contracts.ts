import assert from "node:assert/strict";

import {
  SalesErpError,
  SalesErpMockAdapter,
  buildSalesErpCommand,
  canonicalSalesErpJson,
  createSalesErpPort,
  salesErpMockDataset,
  type SalesErpCommandContext,
} from "../lib/server/integrations/sales-erp";

const fixedNow = new Date("2026-07-16T12:00:00.000Z");
const context: SalesErpCommandContext = {
  actorUserId: "mock-user-be-001",
  representativeExternalId: "mock-rep-be-001",
  deviceId: "mock-device-be-001",
  country: "BE",
  appointmentExternalId: "mock-appointment-be-001",
};

async function main() {
  const adapter = new SalesErpMockAdapter({ now: () => fixedNow, defaultPageSize: 1 });

  const capabilities = await adapter.getCapabilities();
  assert.equal(capabilities.provider, "MOCK");
  assert(capabilities.supportedBootstrapResources.includes("customers"));
  assert(capabilities.supportedCommands.includes("sales-document.create"));

  const belgianCustomers = await adapter.getBootstrapPage({
    resource: "customers",
    country: "BE",
    representativeExternalId: "mock-rep-be-001",
    effectiveTeamExternalIds: [],
  });
  assert.deepEqual(belgianCustomers.items.map((item) => item.externalId), ["mock-customer-be-001"]);
  assert.equal(belgianCustomers.generatedAt, fixedNow.toISOString());

  const outcomeReasonsPage1 = await adapter.getBootstrapPage({
    resource: "appointmentOutcomeReasons",
    country: "BE",
    representativeExternalId: "mock-rep-be-001",
    effectiveTeamExternalIds: [],
  });
  assert.equal(outcomeReasonsPage1.items.length, 1);
  assert.equal(outcomeReasonsPage1.nextCursor, "bootstrap-appointmentOutcomeReasons:1");
  const outcomeReasonsPage2 = await adapter.getBootstrapPage({
    resource: "appointmentOutcomeReasons",
    country: "BE",
    representativeExternalId: "mock-rep-be-001",
    effectiveTeamExternalIds: [],
    cursor: outcomeReasonsPage1.nextCursor,
  });
  assert.equal(outcomeReasonsPage2.items[0].code, "OTHER");
  assert.equal(outcomeReasonsPage2.nextCursor, undefined);

  const firstEventPage = await adapter.getEvents({ limit: 1 });
  assert.equal(firstEventPage.events[0].messageId, "mock-event-customer-be-001");
  assert.equal(firstEventPage.nextCursor, "events:1");
  assert.equal(firstEventPage.hasMore, true);

  assert.equal(
    canonicalSalesErpJson({ z: 1, nested: { b: 2, a: 1 } }),
    canonicalSalesErpJson({ nested: { a: 1, b: 2 }, z: 1 }),
  );

  const customerCommand = buildSalesErpCommand({
    commandId: "mock-command-customer-001",
    issuedAt: fixedNow.toISOString(),
    commandType: "customer.upsert",
    businessKey: "relation:local-relation-001",
    context,
    payload: {
      localRelationId: "local-relation-001",
      externalId: "mock-customer-be-001",
      relationType: "CUSTOMER",
      expectedSourceVersion: "mock-v1",
      legalName: "Demo Veiligheid Brussel",
      displayName: "Demo Brussel",
      vatNumber: "BE0000000097",
      preferredLanguage: "nl",
      contacts: [],
      addresses: [],
      validation: { status: "VALID", modulo97Valid: true, viesCheckedAt: fixedNow.toISOString() },
    },
  });

  const accepted = await adapter.submitCommand(customerCommand);
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(accepted.externalEntityId, "mock:customer.upsert:relation:local-relation-001");
  assert.deepEqual(await adapter.submitCommand(customerCommand), accepted);
  assert.equal(adapter.inspectSubmittedCommands().length, 1);

  const conflictingCommand = {
    ...customerCommand,
    commandId: "mock-command-customer-conflict",
    payload: { ...customerCommand.payload, displayName: "Gewijzigde demo" },
  };
  await assert.rejects(
    () => adapter.submitCommand(conflictingCommand),
    (error: unknown) => error instanceof SalesErpError && error.code === "IDEMPOTENCY_CONFLICT",
  );

  const followUpCommand = buildSalesErpCommand({
    commandId: "mock-command-follow-up-001",
    issuedAt: fixedNow.toISOString(),
    commandType: "follow-up.create",
    businessKey: "follow-up:local-follow-up-001",
    context,
    dependsOnCommandIds: ["mock-command-reference-001"],
    payload: {
      appointmentExternalId: "mock-appointment-be-001",
      localFollowUpId: "local-follow-up-001",
      customerExternalId: "mock-customer-be-001",
      type: "BACKOFFICE",
      description: "Mockgegevens controleren",
    },
  });
  const dependencyPending = await adapter.submitCommand(followUpCommand);
  assert.equal(dependencyPending.status, "RETRYABLE");
  assert.equal(dependencyPending.errorCode, "DEPENDENCY_NOT_ACKNOWLEDGED");

  const referenceCommand = buildSalesErpCommand({
    commandId: "mock-command-reference-001",
    issuedAt: fixedNow.toISOString(),
    commandType: "reference.create",
    businessKey: "reference:local-reference-001",
    context,
    payload: {
      appointmentExternalId: "mock-appointment-be-001",
      localReferenceId: "local-reference-001",
      referringCustomerExternalId: "mock-customer-be-001",
      proposedName: "Aangebrachte demo prospect",
    },
  });
  assert.equal((await adapter.submitCommand(referenceCommand)).status, "ACCEPTED");
  assert.equal((await adapter.submitCommand(followUpCommand)).status, "ACCEPTED");

  const reconciliation = await adapter.reconcile({
    commandIds: [customerCommand.commandId, "mock-command-unknown"],
  });
  assert.deepEqual(reconciliation.acknowledgements.map((item) => item.commandId), [customerCommand.commandId]);
  assert.deepEqual(reconciliation.unknownCommandIds, ["mock-command-unknown"]);

  await assert.rejects(
    () => adapter.getEvents({ cursor: "bad-cursor" }),
    (error: unknown) => error instanceof SalesErpError && error.code === "CURSOR_INVALID",
  );
  assert.throws(
    () => createSalesErpPort({ provider: "MOCK", runtimeEnvironment: "production" }),
    (error: unknown) => error instanceof SalesErpError && error.code === "PROVIDER_UNAVAILABLE",
  );
  assert.throws(
    () => createSalesErpPort({ provider: "BC_NAV", runtimeEnvironment: "test" }),
    (error: unknown) => error instanceof SalesErpError && error.code === "UNSUPPORTED_CAPABILITY",
  );

  assert.equal(salesErpMockDataset.customers.every((customer) => customer.isDemo), true);
  assert.deepEqual(new Set(salesErpMockDataset.customers.map((customer) => customer.scope.country)), new Set(["BE", "NL", "DE"]));

  console.log("Sales ERP-contracten: scope, cursors, mockdata, idempotency, dependencies en reconciliatie gevalideerd.");
}

void main();
