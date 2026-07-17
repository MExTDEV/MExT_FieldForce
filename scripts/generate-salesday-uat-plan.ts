const countries = ["BE", "NL", "DE"] as const;
const groups = ["Representative", "Sales Leader", "Backoffice", "Admin"] as const;
const scenarios = [
  "online bootstrap and full offline dataset",
  "next-workday preparation visibility at country configured time",
  "today agenda and binding ERP/contact-center sequence",
  "own same-day appointment with offline customer search",
  "prospect then first sale/customer creation",
  "direct customer update and later official billing normalisation",
  "complete and non-complete appointment plus day closure",
  "visit report, lead, follow-up and reference",
  "Order, Order-Reeds-Geleverd and Factuur",
  "document override with mandatory reason",
  "signature and unsigned exception",
  "offline print and later ERP delivery acknowledgement",
  "partial/damaged replenishment with photo/signature",
  "carrier delivery, expiry warning and optional count correction",
  "consumables request",
  "cash zero gate on first effective workday",
  "day-minus-one sync block",
  "central ERP emergency mode",
  "manager read-only scope and forbidden mutation attempt",
  "device lock/resume, autosaved draft and MDM remote invalidation",
] as const;

export function buildSalesDayUatPlan() {
  return countries.flatMap((country) =>
    groups.flatMap((group) =>
      scenarios.map((scenario, index) => ({
        id: `${country}-${group.replace(/\s+/g, "-").toUpperCase()}-${String(index + 1).padStart(2, "0")}`,
        country,
        group,
        sequence: index + 1,
        scenario,
        requiredEvidence: "tester, timestamp, device, data set, expected/actual result and screenshot/log reference",
        status: "NOT_RUN",
      })),
    ),
  );
}

if (require.main === module) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    countries,
    groups,
    scenarioCount: scenarios.length,
    items: buildSalesDayUatPlan(),
  }, null, 2));
}
