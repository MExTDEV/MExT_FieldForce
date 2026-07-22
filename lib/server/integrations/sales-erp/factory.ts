import type { SalesErpProvider } from "./contracts";
import { SalesErpError } from "./errors";
import { SalesErpMockAdapter, type SalesErpMockAdapterOptions } from "./mock-adapter";
import type { SalesErpPort } from "./port";
import { isSalesDayProductionMockModeEnabled } from "@/lib/salesday/runtime-configuration";

export function createSalesErpPort(input: {
  provider: SalesErpProvider;
  runtimeEnvironment?: string;
  allowProductionMock?: boolean;
  mockOptions?: SalesErpMockAdapterOptions;
}): SalesErpPort {
  if (input.provider === "MOCK") {
    const allowProductionMock = input.allowProductionMock ?? isSalesDayProductionMockModeEnabled();
    if ((input.runtimeEnvironment ?? process.env.NODE_ENV) === "production" && !allowProductionMock) {
      throw new SalesErpError({
        code: "PROVIDER_UNAVAILABLE",
        message: "The Sales ERP mock provider is disabled in production",
      });
    }
    return new SalesErpMockAdapter({
      ...input.mockOptions,
      runtimeEnvironment: input.runtimeEnvironment ?? process.env.NODE_ENV,
      allowProductionMock,
    });
  }

  throw new SalesErpError({
    code: "UNSUPPORTED_CAPABILITY",
    message: `No ${input.provider} Sales ERP adapter has been configured`,
  });
}
