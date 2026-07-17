import type { SalesErpCountryCode } from "@/lib/server/integrations/sales-erp/contracts";

export type BillingAuthority = "VIES" | "PEPPOL";

export type AuthoritativeBillingIdentity = {
  legalName?: string;
  vatNumber: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  country: SalesErpCountryCode;
};

export type BillingAuthorityResult =
  | { status: "VALID"; authority: BillingAuthority; checkedAt: string; identity: AuthoritativeBillingIdentity }
  | { status: "INVALID"; authority: BillingAuthority; checkedAt: string }
  | { status: "UNAVAILABLE"; authority: BillingAuthority; retryable: true; message?: string };

export interface BillingValidationPort {
  readonly authority: BillingAuthority;
  validate(input: { country: SalesErpCountryCode; vatNumber: string }): Promise<BillingAuthorityResult>;
}

export class UnavailableBillingValidationPort implements BillingValidationPort {
  constructor(readonly authority: BillingAuthority) {}

  async validate(): Promise<BillingAuthorityResult> {
    return {
      status: "UNAVAILABLE",
      authority: this.authority,
      retryable: true,
      message: `${this.authority} is niet geconfigureerd.`,
    };
  }
}

export function validateVatLocally(country: SalesErpCountryCode, value: string) {
  const vatNumber = normalizeVatNumber(value);
  if (!vatNumber) return { vatNumber, formatValid: false, modulo97Valid: null };
  if (country === "BE") {
    const digits = vatNumber.replace(/^BE/, "");
    const formatValid = /^\d{10}$/.test(digits);
    const modulo97Valid = formatValid
      ? Number(digits.slice(8)) === 97 - (Number(digits.slice(0, 8)) % 97)
      : false;
    return { vatNumber: `BE${digits}`, formatValid, modulo97Valid };
  }
  if (country === "NL") {
    return { vatNumber, formatValid: /^NL\d{9}B\d{2}$/.test(vatNumber), modulo97Valid: null };
  }
  return { vatNumber, formatValid: /^DE\d{9}$/.test(vatNumber), modulo97Valid: null };
}

export async function validateBillingIdentity(input: {
  country: SalesErpCountryCode;
  vatNumber: string;
  vies?: BillingValidationPort;
  peppol?: BillingValidationPort;
}) {
  const local = validateVatLocally(input.country, input.vatNumber);
  if (!local.formatValid || local.modulo97Valid === false) {
    return {
      local,
      status: "INVALID" as const,
      authorities: [] as BillingAuthorityResult[],
      authoritativeIdentity: null,
      authoritativeConflict: false,
    };
  }
  const ports = [
    input.vies ?? new UnavailableBillingValidationPort("VIES"),
    input.peppol ?? new UnavailableBillingValidationPort("PEPPOL"),
  ];
  const authorities = await Promise.all(ports.map((port) => port.validate({ country: input.country, vatNumber: local.vatNumber })));
  const valid = authorities.filter((result): result is Extract<BillingAuthorityResult, { status: "VALID" }> => result.status === "VALID");
  const invalid = authorities.filter((result) => result.status === "INVALID");
  const authoritativeConflict = valid.length > 0 && invalid.length > 0 || identitiesConflict(valid.map((result) => result.identity));
  const authoritativeIdentity = authoritativeConflict ? null : mergeIdentity(valid.map((result) => result.identity));
  const status = authoritativeConflict
    ? "CONFLICT"
    : invalid.length > 0
      ? "INVALID"
      : valid.length > 0
        ? "VALID"
        : "UNAVAILABLE";
  return { local, status, authorities, authoritativeIdentity, authoritativeConflict };
}

export function normalizeVatNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function identitiesConflict(identities: AuthoritativeBillingIdentity[]) {
  if (identities.length < 2) return false;
  const [first, ...rest] = identities;
  return rest.some((identity) =>
    normalizeVatNumber(identity.vatNumber) !== normalizeVatNumber(first.vatNumber)
    || Boolean(identity.legalName && first.legalName && normalizeText(identity.legalName) !== normalizeText(first.legalName)),
  );
}

function mergeIdentity(identities: AuthoritativeBillingIdentity[]) {
  if (!identities.length) return null;
  return identities.reduce<AuthoritativeBillingIdentity>((merged, identity) => ({
    ...merged,
    ...Object.fromEntries(Object.entries(identity).filter(([, value]) => value !== undefined && value !== "")),
  }), identities[0]);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("nl-BE");
}
