export type SalesErpErrorCode =
  | "INVALID_CONTRACT"
  | "UNSUPPORTED_CAPABILITY"
  | "IDEMPOTENCY_CONFLICT"
  | "EVENT_PAYLOAD_CONFLICT"
  | "DEPENDENCY_NOT_ACKNOWLEDGED"
  | "COMMAND_LEASE_LOST"
  | "PERMISSION_REVOKED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_REJECTED"
  | "CURSOR_INVALID";

export class SalesErpError extends Error {
  readonly code: SalesErpErrorCode;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(input: {
    code: SalesErpErrorCode;
    message: string;
    retryable?: boolean;
    details?: Readonly<Record<string, string>>;
  }) {
    super(input.message);
    this.name = "SalesErpError";
    this.code = input.code;
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

export function invalidSalesErpContract(message: string, details?: Readonly<Record<string, string>>): never {
  throw new SalesErpError({ code: "INVALID_CONTRACT", message, details });
}
