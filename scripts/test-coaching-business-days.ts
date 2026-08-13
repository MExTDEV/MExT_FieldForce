import assert from "node:assert/strict";
import { addBusinessDaysToDateKey, applicationDateKey, defaultCoachingDate } from "@/lib/coaching/business-days";

assert.equal(addBusinessDaysToDateKey("2026-08-10", 5), "2026-08-17");
assert.equal(addBusinessDaysToDateKey("2026-08-11", 5), "2026-08-18");
assert.equal(addBusinessDaysToDateKey("2026-08-14", 5), "2026-08-21");
assert.equal(addBusinessDaysToDateKey("2026-08-15", 5), "2026-08-21");
assert.equal(addBusinessDaysToDateKey("2026-08-16", 5), "2026-08-21");
assert.equal(addBusinessDaysToDateKey("2026-12-28", 5), "2027-01-04");
assert.equal(defaultCoachingDate(new Date("2026-03-29T23:30:00Z")), "2026-04-06");
assert.equal(applicationDateKey(new Date("2026-03-29T23:30:00Z")), "2026-03-30");

console.log("Coaching business-day tests passed.");
