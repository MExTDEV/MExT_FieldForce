import type { AppModuleCode, AppModuleConfig } from "@/lib/types";

export type ModuleRegistryItem = {
  code: AppModuleCode;
  name: string;
  href: string;
  navKey: string;
  icon: string;
  routePrefixes: string[];
};

export const appModuleRegistry: ModuleRegistryItem[] = [
  {
    code: "PLANNING",
    name: "Planning",
    href: "/planning",
    navKey: "nav.planning",
    icon: "CalendarDays",
    routePrefixes: ["planning"],
  },
  {
    code: "BEGELEIDINGEN",
    name: "Begeleidingen",
    href: "/begeleidingen",
    navKey: "nav.coachings",
    icon: "ClipboardCheck",
    routePrefixes: ["begeleidingen"],
  },
  {
    code: "CONTACTMOMENTEN",
    name: "Contactmomenten",
    href: "/contactmomenten",
    navKey: "nav.contacts",
    icon: "Contact",
    routePrefixes: ["contactmomenten"],
  },
  {
    code: "RETRAININGEN",
    name: "Retrainingen",
    href: "/retrainingen",
    navKey: "nav.retrainings",
    icon: "BookOpenCheck",
    routePrefixes: ["retrainingen"],
  },
  {
    code: "SALESTRAININGEN",
    name: "Salestrainingen",
    href: "/sales-trainingen",
    navKey: "nav.trainings",
    icon: "GraduationCap",
    routePrefixes: ["sales-trainingen"],
  },
  {
    code: "HULPAANVRAGEN",
    name: "Hulpaanvragen",
    href: "/hulpaanvragen",
    navKey: "nav.help",
    icon: "CircleHelp",
    routePrefixes: ["hulpaanvragen"],
  },
  {
    code: "ACTIEPUNTEN",
    name: "Actiepunten",
    href: "/actiepunten",
    navKey: "nav.actions",
    icon: "Target",
    routePrefixes: ["actiepunten", "mijn-reflecties", "mijn-verslagen"],
  },
  {
    code: "RAPPORTERING",
    name: "Rapportering",
    href: "/rapportering",
    navKey: "nav.reporting",
    icon: "BarChart3",
    routePrefixes: ["rapportering"],
  },
];

const defaultEnabledModules = new Set<AppModuleCode>([
  "PLANNING",
  "BEGELEIDINGEN",
]);

export const defaultAppModules: AppModuleConfig[] = appModuleRegistry.map((module) => ({
  id: `module-${module.code.toLowerCase()}`,
  code: module.code,
  name: module.name,
  enabled: defaultEnabledModules.has(module.code),
  createdAt: "2026-06-16T00:00:00.000Z",
  updatedAt: "2026-06-16T00:00:00.000Z",
}));

export function normalizeAppModules(stored: AppModuleConfig[]) {
  const byCode = new Map(stored.map((module) => [module.code, module]));
  return appModuleRegistry.map((module) => {
    const current = byCode.get(module.code);
    return current
      ? { ...current, name: module.name }
      : defaultAppModules.find((item) => item.code === module.code)!;
  });
}

export function moduleForRoute(segment: string) {
  return appModuleRegistry.find((module) =>
    module.routePrefixes.includes(segment)
  );
}
