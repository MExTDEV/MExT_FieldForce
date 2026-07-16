import assert from "node:assert/strict";
import { calculateContract } from "../lib/contract/calculation-engine";

const lines = [
  {
    articleId: "article-1",
    articleNumber: "A-001",
    stemNumber: "001",
    descriptionNl: "Artikel",
    descriptionFr: "Artikel",
    descriptionDe: "Artikel",
    unitPrice: "100",
    unitCost: "20",
    quantity: "2",
  },
];

const threeYears = calculateContract({
  lines,
  term: { durationYears: 3, discountPercentage: "35", priceMultiplier: "0.65" },
});
assert.equal(threeYears.subtotal.toString(), "200");
assert.equal(threeYears.discountAmount.toString(), "70");
assert.equal(threeYears.annualPrice.toString(), "130");
assert.equal(threeYears.totalCost.toString(), "40");

const fiveYears = calculateContract({
  lines,
  term: { durationYears: 5, discountPercentage: "40", priceMultiplier: "0.60" },
});
assert.equal(fiveYears.subtotal.toString(), "200");
assert.equal(fiveYears.discountAmount.toString(), "80");
assert.equal(fiveYears.annualPrice.toString(), "120");

const zeroRevenue = calculateContract({
  lines: [{ ...lines[0], unitPrice: "0", unitCost: "10" }],
  term: { durationYears: 3, discountPercentage: "35", priceMultiplier: "0.65" },
});
assert.equal(zeroRevenue.annualPrice.toString(), "0");

assert.throws(() => calculateContract({ lines: [], term: { durationYears: 3, discountPercentage: "35", priceMultiplier: "0.65" } }));
assert.throws(() => calculateContract({ lines, term: { durationYears: 4, discountPercentage: "0", priceMultiplier: "1" } }));

console.log("Contractcalculatie: Decimal-berekening, kortingen, nulprijs en validaties gevalideerd.");
