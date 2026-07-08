import { prisma } from "@/lib/server/db";
import { appModuleRegistry } from "@/lib/modules";
import type { AppModuleCode, AppModuleConfig } from "@/lib/types";

function toAppModuleConfig(appModule: {
  id: string;
  code: string;
  naam: string;
  actief: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AppModuleConfig {
  return {
    id: appModule.id,
    code: appModule.code as AppModuleCode,
    name: appModule.naam,
    enabled: appModule.actief,
    createdAt: appModule.createdAt.toISOString(),
    updatedAt: appModule.updatedAt.toISOString(),
  };
}

export async function listAppModules() {
  await ensureAppModules();
  const modules = await prisma.appModule.findMany({
    orderBy: { code: "asc" },
  });
  const byCode = new Map(modules.map((appModule) => [appModule.code, appModule]));
  return appModuleRegistry.flatMap((registered) => {
    const storedModule = byCode.get(registered.code);
    return storedModule ? [toAppModuleConfig(storedModule)] : [];
  });
}

export async function setAppModuleEnabled(
  code: AppModuleCode,
  enabled: boolean
) {
  const registryItem = appModuleRegistry.find((module) => module.code === code);
  if (!registryItem) {
    throw new Error("Onbekende module.");
  }
  const appModule = await prisma.appModule.upsert({
    where: { code },
    update: { naam: registryItem.name, actief: enabled },
    create: { code, naam: registryItem.name, actief: enabled },
  });
  return toAppModuleConfig(appModule);
}

export async function isAppModuleEnabled(code: AppModuleCode) {
  const modules = await listAppModules();
  return modules.some((module) => module.code === code && module.enabled);
}

async function ensureAppModules() {
  await Promise.all(
    appModuleRegistry.map((registryItem) =>
      prisma.appModule.upsert({
        where: { code: registryItem.code },
        update: { naam: registryItem.name },
        create: {
          code: registryItem.code,
          naam: registryItem.name,
          actief: registryItem.code === "PLANNING" || registryItem.code === "BEGELEIDINGEN",
        },
      })
    )
  );
}
