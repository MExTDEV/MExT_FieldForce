import type { SalesErpProvider } from "./contracts";
import { SalesErpError } from "./errors";
import { SalesErpMockAdapter, type SalesErpMockAdapterOptions } from "./mock-adapter";
import type { SalesErpPort } from "./port";

export function createSalesErpPort(input: {
  provider: SalesErpProvider;
  runtimeEnvironment?: string;
  mockOptions?: SalesErpMockAdapterOptions;
}): SalesErpPort {
  if (input.provider === "MOCK") {
    if ((input.runtimeEnvironment ?? process.env.NODE_ENV) === "production") {
      throw new SalesErpError({
        code: "PROVIDER_UNAVAILABLE",
        message: "The Sales ERP mock provider is disabled in production",
      });
    }
    return new SalesErpMockAdapter({
      ...input.mockOptions,
      runtimeEnvironment: input.runtimeEnvironment ?? process.env.NODE_ENV,
    });
  }

  throw new SalesErpError({
    code: "UNSUPPORTED_CAPABILITY",
    message: `No ${input.provider} Sales ERP adapter has been configured`,
  });
}
