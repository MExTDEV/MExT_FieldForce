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
  ListChecks,
  Mail,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
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
  canAccessInventory,
  canAccessPST,
  canAccessSalesday,
  canAccessService,
} from "@/lib/permissions";
import { canAccessManagementSection } from "@/lib/management-access";
import {
  canAccessCoachingModuleNavigation,
  canAccessDashboard,
  canAccessMyTeamNavigation,
} from "@/lib/navigation-access";

export type AppSwitcherDomainKey =
  | "coaching"
  | "salesday"
  | "inventory"
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
          moduleEnabled(modules, "BEGELEIDINGEN") && canAccessDashboard(user),
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
          moduleEnabled(modules, "PLANNING") &&
          canAccessCoachingModuleNavigation(user, "PLANNING"),
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
          moduleEnabled(modules, "BEGELEIDINGEN") &&
          canAccessCoachingModuleNavigation(user, "BEGELEIDINGEN"),
      },
      {
        key: "contacts",
        label: "Contactmomenten",
        description: "Opvolgmomenten",
        href: "/contactmomenten",
        icon: Contact,
        permission: "menu.coaching.contacts",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "CONTACTMOMENTEN") &&
          canAccessCoachingModuleNavigation(user, "CONTACTMOMENTEN"),
      },
      {
        key: "retrainings",
        label: "Retrainingen",
        description: "Gerichte bijscholing",
        href: "/retrainingen",
        icon: BookOpenCheck,
        permission: "menu.coaching.retrainings",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "RETRAININGEN") &&
          canAccessCoachingModuleNavigation(user, "RETRAININGEN"),
      },
      {
        key: "trainings",
        label: "Sales trainingen",
        description: "Trainingen en opvolging",
        href: "/sales-trainingen",
        icon: GraduationCap,
        permission: "menu.coaching.trainings",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "SALESTRAININGEN") &&
          canAccessCoachingModuleNavigation(user, "SALESTRAININGEN"),
      },
      {
        key: "help",
        label: "Hulpaanvragen",
        description: "Ondersteuningsvragen",
        href: "/hulpaanvragen",
        icon: CircleHelp,
        permission: "menu.coaching.help",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "HULPAANVRAGEN") &&
          canAccessCoachingModuleNavigation(user, "HULPAANVRAGEN"),
      },
      {
        key: "starterEvaluations",
        label: "Tussentijdse evaluaties",
        description: "Startersevaluaties opvolgen",
        href: "/tussentijdse-evaluaties",
        icon: ClipboardCheck,
        permission: "menu.coaching.starterEvaluations",
        tone: coachingLinkTone,
        isAvailable: (user, modules) =>
          moduleEnabled(modules, "TUSSENTIJDSE_EVALUATIES") &&
          canAccessCoachingModuleNavigation(user, "TUSSENTIJDSE_EVALUATIES"),
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
          canAccessMyTeamNavigation(user),
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
          moduleEnabled(modules, "ACTIEPUNTEN") &&
          canAccessCoachingModuleNavigation(user, "ACTIEPUNTEN"),
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
          moduleEnabled(modules, "RAPPORTERING") &&
          canAccessCoachingModuleNavigation(user, "RAPPORTERING"),
      },
      {
        key: "users",
        label: "Gebruikers",
        description: "Beheer van accounts en rechten",
        href: "/beheer/gebruikers",
        icon: Users,
        permission: "menu.coaching.users",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "gebruikers"),
      },
      {
        key: "teams",
        label: "Teams",
        description: "Teamstructuur beheren",
        href: "/beheer/teams",
        icon: UsersRound,
        permission: "menu.coaching.teams",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "teams"),
      },
      {
        key: "modules",
        label: "Modules",
        description: "Technisch beheer en activatie",
        href: "/beheer/modules",
        icon: Settings,
        permission: "menu.coaching.modules",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "modules"),
      },
      {
        key: "roles",
        label: "Rollen",
        description: "Toegangs- en rechtenstructuur",
        href: "/beheer/rollen",
        icon: ShieldCheck,
        permission: "menu.coaching.roles",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "rollen"),
      },
      {
        key: "kpis",
        label: "KPI's",
        description: "KPI-definities beheren",
        href: "/beheer/kpis",
        icon: BarChart3,
        permission: "menu.coaching.kpis",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "kpis"),
      },
      {
        key: "framework",
        label: "Kapstok",
        description: "Coachingkapstok beheren",
        href: "/beheer/kapstok",
        icon: MessageSquareText,
        permission: "menu.coaching.framework",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "kapstok"),
      },
      {
        key: "mail",
        label: "Mail",
        description: "Mailinstellingen",
        href: "/beheer/instellingen/mail",
        icon: Mail,
        permission: "menu.coaching.settings",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "mail"),
      },
      {
        key: "profile",
        label: "Profiel",
        description: "Microsoft-profielgegevens",
        href: "/beheer/instellingen/profiel",
        icon: UserRound,
        permission: "menu.coaching.settings",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "profiel"),
      },
      {
        key: "log",
        label: "Log",
        description: "Actiehistoriek",
        href: "/beheer/log",
        icon: ListChecks,
        permission: "menu.coaching.log",
        tone: coachingLinkTone,
        isAvailable: (user) => canAccessManagementSection(user, "log"),
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
    key: "inventory",
    title: "Inventory",
    subtitle: "Voorraad. Bevoorrading. Dragers.",
    icon: Contact,
    enabledPermission: "menu.inventory.enabled",
    isAvailable: withinDomain(canAccessInventory),
    links: [
      { key: "myStock", label: "Mijn voorraad", description: "Vertegenwoordigers- en voertuigstock", href: "/inventory/mijn-voorraad", icon: Contact, permission: "menu.inventory.myStock", tone: placeholderTone, isAvailable: withinDomain(canAccessInventory) },
      { key: "replenishments", label: "Bevoorrading", description: "Transit, ontvangst en bewijs", href: "/inventory/bevoorrading", icon: ClipboardCheck, permission: "menu.inventory.replenishments", tone: placeholderTone, isAvailable: withinDomain(canAccessInventory) },
      { key: "consumables", label: "Verbruiksgoederen", description: "Aanvraag naar ERP", href: "/inventory/verbruiksgoederen", icon: ListChecks, permission: "menu.inventory.consumables", tone: placeholderTone, isAvailable: withinDomain(canAccessInventory) },
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
      { key: "dashboard", label: "Dashboard", description: "Contractwaarde en recente berekeningen", href: "/contract", icon: LayoutDashboard, permission: "menu.contract.open", tone: coachingLinkTone, isAvailable: withinDomain(canAccessContract) },
      { key: "new", label: "Nieuwe berekening", description: "Contractprijs berekenen", href: "/contract/new", icon: ClipboardCheck, permission: "menu.contract.open", tone: coachingLinkTone, isAvailable: withinDomain(canAccessContract) },
      { key: "calculations", label: "Berekeningen", description: "Concepten en ondertekende contracten", href: "/contract/calculations", icon: ListChecks, permission: "menu.contract.open", tone: coachingLinkTone, isAvailable: withinDomain(canAccessContract) },
      { key: "customers", label: "Klanten", description: "Manuele klantgegevens", href: "/contract/customers", icon: Users, permission: "menu.contract.open", tone: coachingLinkTone, isAvailable: withinDomain(canAccessContract) },
      { key: "reporting", label: "Rapportering", description: "Omzet en kost", href: "/contract/reporting", icon: BarChart3, permission: "menu.contract.open", tone: coachingLinkTone, isAvailable: withinDomain(canAccessContract) },
      { key: "manage", label: "Beheer", description: "Artikelen, import en modellen", href: "/contract/manage", icon: Settings, permission: "menu.contract.open", tone: coachingLinkTone, isAvailable: (user) => ["ADMIN", "SUPER_ADMIN"].includes(user.role) },
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
  if (segment === "inventory") return "inventory";
  if (segment === "pst") return "pst";
  if (segment === "contract") return "contract";
  if (segment === "service") return "service";
  return "coaching";
}
