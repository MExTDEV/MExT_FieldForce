import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  Contact,
  GraduationCap,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Target,
  Users,
  UsersRound,
} from "lucide-react";
import type {
  AppModuleConfig,
  FieldForcePermissionKey,
  MockUser,
} from "@/lib/types";
import {
  can,
  canAccessCoaching,
  canAccessContract,
  canAccessPST,
  canAccessSalesday,
  canAccessService,
  canAccessTechnicalManagement,
  canAccessUserManagement,
  canViewTeamDashboard,
} from "@/lib/permissions";

export type AppSwitcherDomainKey =
  | "coaching"
  | "salesday"
  | "pst"
  | "contract"
  | "service";

export type AppSwitcherLink = {
  key: string;
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  permission: FieldForcePermissionKey;
  available: boolean;
  tone?: string;
};

export type AppSwitcherDomain = {
  key: AppSwitcherDomainKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  enabledPermission: FieldForcePermissionKey;
  available: boolean;
  links: AppSwitcherLink[];
};

type LinkDefinition = Omit<AppSwitcherLink, "available"> & {
  isAvailable: (user: MockUser, modules: AppModuleConfig[]) => boolean;
};

type DomainDefinition = Omit<AppSwitcherDomain, "available" | "links"> & {
  isAvailable: (user: MockUser, modules: AppModuleConfig[]) => boolean;
  links: LinkDefinition[];
};

const coachingLinkTone = "bg-brand-50 text-brand-700";
const placeholderTone = "bg-slate-50 text-slate-600";

function moduleEnabled(
  modules: AppModuleConfig[],
  code: AppModuleConfig["code"]
) {
  return modules.some((module) => module.code === code && module.enabled);
}

const withinDomain = (
  access: (user: MockUser) => boolean
) => (user: MockUser) => access(user);

export const appSwitcherDomains: DomainDefinition[] = [
  {
    key: "coaching",
    title: "Coaching",
    subtitle: "Grow. Coach. Perform.",
    icon: ClipboardCheck,
    enabledPermission: "menu.coaching.enabled",
    isAvailable: (user) => canAccessCoaching(user),
    links: [
      {
        key: "dashboard",
        label: "Dashboard",
        description: "Overzicht van de dag",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "menu.coaching.dashboard",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "BEGELEIDINGEN") && can(user, "moduleDashboard"),
      },
      {
        key: "planning",
        label: "Planning",
        description: "Agenda en routes",
        href: "/planning",
        icon: CalendarDays,
        permission: "menu.coaching.planning",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "PLANNING") && can(user, "moduleAgenda"),
      },
      {
        key: "coachings",
        label: "Begeleidingen",
        description: "Alle coachingsmomenten",
        href: "/begeleidingen",
        icon: ClipboardCheck,
        permission: "menu.coaching.coachings",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "BEGELEIDINGEN") && can(user, "moduleVisitRecord"),
      },
      {
        key: "myTeam",
        label: "Mijn Team",
        description: "Vertegenwoordigers in scope",
        href: "/mijn-team",
        icon: UsersRound,
        permission: "menu.coaching.myTeam",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "BEGELEIDINGEN") &&
          canViewTeamDashboard(user) &&
          can(user, "moduleMyTeam"),
      },
      {
        key: "actionPoints",
        label: "Actiepunten",
        description: "Opvolgacties en prioriteiten",
        href: "/actiepunten",
        icon: Target,
        permission: "menu.coaching.actionPoints",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "ACTIEPUNTEN") && can(user, "modulePreparation"),
      },
      {
        key: "reporting",
        label: "Rapportering",
        description: "KPI's en dashboards",
        href: "/rapportering",
        icon: BarChart3,
        permission: "menu.coaching.reporting",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "RAPPORTERING") && can(user, "moduleReporting"),
      },
      {
        key: "users",
        label: "Gebruikers",
        description: "Beheer van accounts en rechten",
        href: "/beheer/gebruikers",
        icon: Users,
        permission: "menu.coaching.users",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessUserManagement(user),
      },
      {
        key: "modules",
        label: "Modules",
        description: "Technisch beheer en activatie",
        href: "/beheer/modules",
        icon: Settings,
        permission: "menu.coaching.modules",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessTechnicalManagement(user),
      },
      {
        key: "roles",
        label: "Rollen",
        description: "Toegangs- en rechtenstructuur",
        href: "/beheer/rollen",
        icon: ShieldCheck,
        permission: "menu.coaching.roles",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessTechnicalManagement(user),
      },
    ],
  },
  {
    key: "salesday",
    title: "Salesday",
    subtitle: "Agenda. Contact. Sales.",
    icon: CalendarDays,
    enabledPermission: "menu.salesday.enabled",
    isAvailable: withinDomain(canAccessSalesday),
    links: [
      { key: "preparation", label: "Mijn voorbereiding", description: "Tijdelijke route", href: "/salesday/mijn-voorbereiding", icon: BookOpenCheck, permission: "menu.salesday.preparation", tone: placeholderTone, isAvailable: withinDomain(canAccessSalesday) },
      { key: "agenda", label: "Mijn Agenda", description: "Tijdelijke route", href: "/salesday/mijn-agenda", icon: CalendarDays, permission: "menu.salesday.agenda", tone: placeholderTone, isAvailable: withinDomain(canAccessSalesday) },
      { key: "team", label: "Mijn Team", description: "Tijdelijke route", href: "/salesday/mijn-team", icon: UsersRound, permission: "menu.salesday.team", tone: placeholderTone, isAvailable: withinDomain(canAccessSalesday) },
      { key: "stock", label: "Mijn Voorraad", description: "Tijdelijke route", href: "/salesday/mijn-voorraad", icon: Contact, permission: "menu.salesday.stock", tone: placeholderTone, isAvailable: withinDomain(canAccessSalesday) },
    ],
  },
  {
    key: "pst",
    title: "PST",
    subtitle: "Leads. Genehmigung. Contacts.",
    icon: GraduationCap,
    enabledPermission: "menu.pst.enabled",
    isAvailable: withinDomain(canAccessPST),
    links: [
      { key: "dashboard", label: "Dashboard", description: "Tijdelijke route", href: "/pst/dashboard", icon: LayoutDashboard, permission: "menu.pst.dashboard", tone: placeholderTone, isAvailable: withinDomain(canAccessPST) },
      { key: "planning", label: "Planning", description: "Tijdelijke route", href: "/pst/planning", icon: CalendarDays, permission: "menu.pst.planning", tone: placeholderTone, isAvailable: withinDomain(canAccessPST) },
      { key: "segments", label: "Segmenten", description: "Tijdelijke route", href: "/pst/segmenten", icon: Users, permission: "menu.pst.segments", tone: placeholderTone, isAvailable: withinDomain(canAccessPST) },
      { key: "routes", label: "Routes", description: "Tijdelijke route", href: "/pst/routes", icon: BookOpenCheck, permission: "menu.pst.routes", tone: placeholderTone, isAvailable: withinDomain(canAccessPST) },
      { key: "prospecting", label: "Prospectie", description: "Tijdelijke route", href: "/pst/prospectie", icon: Target, permission: "menu.pst.prospecting", tone: placeholderTone, isAvailable: withinDomain(canAccessPST) },
    ],
  },
  {
    key: "contract",
    title: "Contract",
    subtitle: "Calculate. Sign. Deliver.",
    icon: ClipboardCheck,
    enabledPermission: "menu.contract.enabled",
    isAvailable: withinDomain(canAccessContract),
    links: [
      { key: "open", label: "Contracttool openen", description: "Tijdelijke route", href: "/contract", icon: ClipboardCheck, permission: "menu.contract.open", tone: placeholderTone, isAvailable: withinDomain(canAccessContract) },
    ],
  },
  {
    key: "service",
    title: "Service",
    subtitle: "Inspect. Maintain. Protect.",
    icon: CircleHelp,
    enabledPermission: "menu.service.enabled",
    isAvailable: withinDomain(canAccessService),
    links: [
      { key: "myDay", label: "Mijn dag", description: "Tijdelijke route", href: "/service/mijn-dag", icon: LayoutDashboard, permission: "menu.service.myDay", tone: placeholderTone, isAvailable: withinDomain(canAccessService) },
      { key: "planning", label: "Planning", description: "Tijdelijke route", href: "/service/planning", icon: CalendarDays, permission: "menu.service.planning", tone: placeholderTone, isAvailable: withinDomain(canAccessService) },
      { key: "interventions", label: "Interventies", description: "Tijdelijke route", href: "/service/interventies", icon: Target, permission: "menu.service.interventions", tone: placeholderTone, isAvailable: withinDomain(canAccessService) },
    ],
  },
];

export const menuPermissionGroups = appSwitcherDomains.map((domain) => ({
  title: domain.title,
  description: `Mega-menu voor ${domain.title}`,
  permissions: [
    {
      key: domain.enabledPermission,
      label: `${domain.title} tonen`,
    },
    ...domain.links.map((link) => ({ key: link.permission, label: link.label })),
  ],
}));

export const menuPermissionKeys = menuPermissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

export function getConfigurableMenuDomains(
  user: MockUser,
  modules: AppModuleConfig[]
): AppSwitcherDomain[] {
  return appSwitcherDomains.map((domain) => ({
    key: domain.key,
    title: domain.title,
    subtitle: domain.subtitle,
    icon: domain.icon,
    enabledPermission: domain.enabledPermission,
    available: domain.isAvailable(user, modules),
    links: domain.links.map((link) => ({
      ...link,
      available: link.isAvailable(user, modules),
    })),
  }));
}

export function getAvailableDomains(
  user: MockUser,
  modules: AppModuleConfig[]
): AppSwitcherDomain[] {
  return getConfigurableMenuDomains(user, modules)
    .filter(
      (domain) =>
        domain.available && can(user, domain.enabledPermission)
    )
    .map((domain) => ({
      ...domain,
      links: domain.links.filter(
        (link) => link.available && can(user, link.permission)
      ),
    }));
}

export function getDomainForPath(pathname: string): AppSwitcherDomainKey {
  const normalized = pathname.replace(/^\/+/, "");
  const segment = normalized.split("/")[0] ?? "";
  if (["dashboard", "planning", "begeleidingen", "mijn-team", "actiepunten", "rapportering", "beheer", "mijn-gegevens", "taken-vandaag", "vertegenwoordigers", "contactmomenten", "hulpaanvragen", "retrainingen", "sales-trainingen"].includes(segment)) {
    return "coaching";
  }
  if (segment === "salesday") return "salesday";
  if (segment === "pst") return "pst";
  if (segment === "contract") return "contract";
  if (segment === "service") return "service";
  return "coaching";
}
