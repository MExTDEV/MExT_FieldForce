import { Prisma } from "@prisma/client";

export const CONTRACT_CALCULATION_ENGINE_VERSION = "MEXT_CONTRACT_ENGINE_2026_V1";

type DecimalValue = string | number | Prisma.Decimal;

export type ContractCalculationArticleInput = {
  articleId: string;
  articleNumber: string;
  stemNumber: string;
  descriptionNl: string;
  descriptionFr: string;
  descriptionDe: string;
  unitPrice: DecimalValue;
  unitCost: DecimalValue;
  quantity: DecimalValue;
};

export type ContractTermInput = {
  durationYears: number;
  discountPercentage: DecimalValue;
  priceMultiplier: DecimalValue;
};

export type ContractCalculationResultLine = {
  articleId: string;
  articleNumberSnapshot: string;
  stemNumberSnapshot: string;
  descriptionNlSnapshot: string;
  descriptionFrSnapshot: string;
  descriptionDeSnapshot: string;
  quantity: Prisma.Decimal;
  unitPriceSnapshot: Prisma.Decimal;
  unitCostSnapshot: Prisma.Decimal;
  lineAmount: Prisma.Decimal;
  lineCost: Prisma.Decimal;
};

export type ContractCalculationResult = {
  durationYears: number;
  discountPercentage: Prisma.Decimal;
  priceMultiplier: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  annualPrice: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  lines: ContractCalculationResultLine[];
};

const ZERO = new Prisma.Decimal(0);

export function decimal(value: DecimalValue) {
  return new Prisma.Decimal(value);
}

export function roundMoney(value: DecimalValue) {
  return decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function roundPercentage(value: DecimalValue) {
  return decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateContract(input: {
  lines: ContractCalculationArticleInput[];
  term: ContractTermInput;
}): ContractCalculationResult {
  if (!input.lines.length) {
    throw new Error("contract.error.noLines");
  }
  const durationYears = input.term.durationYears;
  if (![3, 5].includes(durationYears)) {
    throw new Error("contract.error.unsupportedDuration");
  }
  const discountPercentage = roundPercentage(input.term.discountPercentage);
  const priceMultiplier = decimal(input.term.priceMultiplier);
  const lines = input.lines.map((line) => {
    const quantity = decimal(line.quantity);
    if (quantity.lte(0)) throw new Error("contract.error.invalidQuantity");
    const unitPrice = decimal(line.unitPrice);
    const unitCost = decimal(line.unitCost);
    const lineAmount = roundMoney(quantity.mul(unitPrice));
    const lineCost = roundMoney(quantity.mul(unitCost));
    return {
      articleId: line.articleId,
      articleNumberSnapshot: line.articleNumber,
      stemNumberSnapshot: line.stemNumber,
      descriptionNlSnapshot: line.descriptionNl,
      descriptionFrSnapshot: line.descriptionFr,
      descriptionDeSnapshot: line.descriptionDe,
      quantity,
      unitPriceSnapshot: unitPrice,
      unitCostSnapshot: unitCost,
      lineAmount,
      lineCost,
    };
  });
  const subtotal = roundMoney(lines.reduce((sum, line) => sum.add(line.lineAmount), ZERO));
  const totalCost = roundMoney(lines.reduce((sum, line) => sum.add(line.lineCost), ZERO));
  const annualPrice = roundMoney(subtotal.mul(priceMultiplier));
  const discountAmount = roundMoney(subtotal.sub(annualPrice));
  return {
    durationYears,
    discountPercentage,
    priceMultiplier,
    subtotal,
    discountAmount,
    annualPrice,
    totalCost,
    lines,
  };
}

export function defaultContractTerms(): ContractTermInput[] {
  return [
    { durationYears: 3, discountPercentage: "35.00", priceMultiplier: "0.6500" },
    { durationYears: 5, discountPercentage: "40.00", priceMultiplier: "0.6000" },
  ];
}
