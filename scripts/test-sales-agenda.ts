import assert from "node:assert/strict";
import { buildSalesAgendaSections } from "../modules/sales/agenda";

const result = buildSalesAgendaSections([
  { id: "closed-late", time: "14:00", status: "completed", statusChangedAt: "2026-08-20T14:00:00Z" },
  { id: "open-late", time: "15:00", status: "planned" },
  { id: "closed-early", time: "09:00", status: "cancelled", statusChangedAt: "2026-08-20T09:00:00Z" },
  { id: "open-early", time: "08:00", status: "rescheduled" },
  { id: "no-time", time: "10:00", status: "no_time" },
  { id: "absent", time: "11:00", status: "customer_absent" },
]);

assert.deepEqual(result.open.map((item) => item.id), ["open-early", "open-late"]);
assert.deepEqual(result.closed.map((item) => item.id), [
  "closed-late",
  "closed-early",
  "absent",
  "no-time",
]);
assert.deepEqual(result.counters, {
  total: 6,
  open: 2,
  closed: 4,
  noTime: 1,
  customerAbsent: 1,
});

console.log("Sales agenda: open/closed-splits, sortering en tellers gevalideerd.");
