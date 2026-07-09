"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Contact,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Target,
  UserCog,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getVisibleManagementSections } from "@/lib/management-access";
import {
  canAccessCoachingModuleNavigation,
  canAccessDashboard,
  canAccessMyTeamNavigation,
} from "@/lib/navigation-access";
import { translate, type TranslationKey } from "@/lib/i18n";
import { useSession } from "@/components/session-provider";
import { SessionFailure } from "@/components/session-state";
import { AppSwitcherMenu } from "@/components/app-switcher-menu";
import {
  notificationBody,
  notificationTitle,
  useNotifications,
} from "@/components/notification-provider";
import { useModules } from "@/components/module-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { useWorkflow } from "@/components/workflow-provider";
import { useRepresentatives } from "@/components/representatives-provider";
import { branding } from "@/config/branding";
import { appModuleRegistry } from "@/lib/modules";
import {
  buildHeaderTodoItems,
  shouldAnimateTodoBell,
  type DashboardAttentionType,
  type HeaderTodoItem,
} from "@/lib/dashboard-attention";
import { dedupeById } from "@/lib/coaching/visibility";
import { reportingUserName } from "@/lib/reporting";
import type { AppNotification } from "@/lib/notifications";
import type { AppModuleCode, MockUser } from "@/lib/types";

const iconMap = {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  Contact,
  GraduationCap,
  LayoutDashboard,
  Target,
  Users,
} as const;

const dashboardNav = { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard };
const myTeamNav = { href: "/mijn-team", key: "nav.myTeam", icon: UsersRound };

const manageNav = [
  { section: "gebruikers", icon: UserCog },
  { section: "teams", icon: UsersRound },
  { section: "rollen", icon: ShieldCheck },
  { section: "kpis", icon: BarChart3 },
  { section: "kapstok", icon: MessageSquareText },
  { section: "modules", icon: Settings },
  { section: "instellingen", icon: Settings },
  { section: "log", icon: ListChecks },
] as const;

const representativeNav = [
  { href: "/mijn-reflecties", key: "nav.myReflections", icon: MessageSquareText },
  { href: "/mijn-verslagen", key: "nav.myReports", icon: ClipboardCheck },
] as const;

function canSeeModuleNav(user: MockUser, code: AppModuleCode) {
  return canAccessCoachingModuleNavigation(user, code);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, language, setLanguage, status } = useSession();
  const { isModuleEnabled } = useModules();
  const { clearSaveError, retrySave, saveError } = useWorkflow();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const visibleManagementSections = getVisibleManagementSections(user);
  const visibleManagementNav = visibleManagementSections.flatMap((section) => {
    const item = manageNav.find((candidate) => candidate.section === section.section);
    return item ? [{ ...section, icon: item.icon }] : [];
  });
  const activeModuleNav = appModuleRegistry
    .filter((module) => isModuleEnabled(module.code) && canSeeModuleNav(user, module.code))
    .map((module) => ({
      href: module.href,
      key: module.navKey,
      icon: iconMap[module.icon as keyof typeof iconMap] ?? LayoutDashboard,
    }));
  const canSeeDashboard = canAccessDashboard(user);
  const canSeeMyTeam =
    isModuleEnabled("BEGELEIDINGEN") && canAccessMyTeamNavigation(user);
  const mainNav = [...(canSeeDashboard ? [dashboardNav] : []), ...(canSeeMyTeam ? [myTeamNav] : []), ...activeModuleNav];

  if (pathname === "/login") return <>{children}</>;
  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-lg bg-brand-100" />
          <h1 className="mt-5 text-lg font-bold text-slate-950">Gebruikerssessie laden</h1>
          <p className="mt-2 text-sm text-slate-500">Je identiteit en rechten worden veilig gecontroleerd.</p>
        </div>
      </main>
    );
  }
  if (status === "error") return <SessionFailure />;
  if (status === "unauthenticated" || !user.id) return null;

  const navigation = (
    <>
      <div className={`flex h-24 items-center border-b border-white/10 ${collapsed ? "justify-center px-2" : "px-4"}`}>
        {collapsed ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/20">
            <Image
              src={branding.logoMarkPath}
              alt={branding.appName}
              fill
              priority
              sizes="48px"
              className="object-contain"
            />
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex h-14 w-[220px] items-center justify-center overflow-hidden rounded-xl bg-white px-1.5 py-1 shadow-sm">
              <Image
                src={branding.logoPath}
                alt={branding.fullAppName}
                width={1774}
                height={887}
                priority
                className="h-full w-full object-contain"
              />
            </div>
            <p className="mt-1.5 text-center text-[11px] font-semibold tracking-[0.14em] text-blue-100">
              {branding.slogan}
            </p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {mainNav.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={translate(language, item.key as TranslationKey)}
            active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        ))}
        {user.role === "REPRESENTATIVE" && isModuleEnabled("ACTIEPUNTEN") && canAccessCoachingModuleNavigation(user, "ACTIEPUNTEN") && representativeNav.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={translate(language, item.key as TranslationKey)}
            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        ))}
        {visibleManagementNav.length > 0 && (
          <>
            {!collapsed && <p className="px-3 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">Beheer</p>}
            {visibleManagementNav.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={translate(language, item.navKey as TranslationKey)}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                collapsed={collapsed}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </>
        )}
      </nav>
      <div className="hidden border-t border-white/10 p-3 lg:block">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex h-11 w-full items-center justify-center rounded-xl text-blue-100 transition hover:bg-white/10"
          aria-label="Sidebar inklappen"
        >
          <PanelLeftClose className={`h-5 w-5 transition ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <ServiceWorkerRegistration />
      <aside className={`fixed inset-y-0 left-0 z-40 hidden bg-brand-900 transition-all duration-200 lg:flex lg:flex-col ${collapsed ? "w-[76px]" : "w-64"}`}>
        {navigation}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileOpen(false)} aria-label="Navigatie sluiten" />
          <aside className="relative flex h-full w-72 flex-col bg-brand-900 shadow-2xl">
            <button className="absolute right-3 top-4 rounded-xl p-2 text-white hover:bg-white/10" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            {navigation}
          </aside>
        </div>
      )}

      <div className={`transition-all duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 sm:hidden">
              <Image
                src={branding.logoMarkPath}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-contain"
              />
              <span className="font-bold text-brand-800">{branding.appName}</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Werkruimte</p>
              <p className="text-sm font-semibold text-slate-800">{user.country} Sales</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 md:flex">
              <span className="text-xs font-semibold text-slate-400">Taal</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as "nl" | "fr" | "de")}
                className="h-10 bg-transparent text-sm font-semibold uppercase outline-none"
              >
                <option value="nl">NL</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
              </select>
            </label>

            <HeaderTodoBell />
            <AppSwitcherMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 pb-24 sm:p-6 lg:p-8">
          {saveError && (
            <div role="alert" className="mb-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 sm:flex-row sm:items-center sm:justify-between">
              <span>{saveError}</span>
              <span className="flex gap-2">
                <button type="button" onClick={retrySave} className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100">
                  Opnieuw proberen
                </button>
                <button type="button" onClick={clearSaveError} className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100">
                  Sluiten
                </button>
              </span>
            </div>
          )}
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden">
        {mainNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold ${active ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}
            >
              <Icon className="h-5 w-5" />
              {translate(language, item.key as TranslationKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const todoIcons: Record<DashboardAttentionType, typeof ClipboardCheck> = {
  begeleiding: ClipboardCheck,
  contactmoment: Contact,
  retraining: GraduationCap,
  sales_training: BookOpenCheck,
  hulpaanvraag: CircleHelp,
};

function HeaderTodoBell() {
  const { language, managedUsers, user } = useSession();
  const { notifications, unreadCount, markAllAsRead, openNotification } = useNotifications();
  const { representatives } = useRepresentatives();
  const { isModuleEnabled } = useModules();
  const {
    visibleContactMoments,
    visibleHelpRequests,
    visibleInterventions,
    visibleRetrainings,
    visibleSalesTrainings,
  } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [wiggling, setWiggling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const todoItems = useMemo(
    () => {
      const coachingTodosEnabled =
        isModuleEnabled("BEGELEIDINGEN") &&
        canAccessCoachingModuleNavigation(user, "BEGELEIDINGEN");
      const contactTodosEnabled =
        isModuleEnabled("CONTACTMOMENTEN") &&
        canAccessCoachingModuleNavigation(user, "CONTACTMOMENTEN");
      const helpTodosEnabled =
        isModuleEnabled("HULPAANVRAGEN") &&
        canAccessCoachingModuleNavigation(user, "HULPAANVRAGEN");
      const retrainingTodosEnabled =
        isModuleEnabled("RETRAININGEN") &&
        canAccessCoachingModuleNavigation(user, "RETRAININGEN");
      const salesTrainingTodosEnabled =
        isModuleEnabled("SALESTRAININGEN") &&
        canAccessCoachingModuleNavigation(user, "SALESTRAININGEN");

      return buildHeaderTodoItems({
        currentUser: user,
        interventions: coachingTodosEnabled ? dedupeById(visibleInterventions(user)) : [],
        contactMoments: contactTodosEnabled ? visibleContactMoments(user) : [],
        helpRequests: helpTodosEnabled ? visibleHelpRequests(user) : [],
        retrainings: retrainingTodosEnabled ? visibleRetrainings(user) : [],
        salesTrainings: salesTrainingTodosEnabled ? visibleSalesTrainings(user) : [],
        representativeName: (id) => {
          const representative = representatives.find((person) => person.id === id);
          return representative ? `${representative.firstName} ${representative.lastName}` : "Onbekend";
        },
        ownerName: (id) => id ? reportingUserName(id, managedUsers) : undefined,
      }).filter((item) => item.todoKind !== "approval");
    },
    [
      isModuleEnabled,
      managedUsers,
      representatives,
      user,
      visibleContactMoments,
      visibleHelpRequests,
      visibleInterventions,
      visibleRetrainings,
      visibleSalesTrainings,
    ],
  );
  const todoCount = todoItems.length;
  const activeCount = unreadCount + todoCount;
  const hasUnreadNotifications = unreadCount > 0;
  const hasTodos = todoCount > 0;
  const hasActivity = activeCount > 0;
  const BellIcon = hasActivity ? BellRing : Bell;

  async function handleMarkAllAsRead() {
    try {
      await markAllAsRead();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[notifications] Meldingen konden niet als gelezen worden gemarkeerd.", error);
      }
    }
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setWiggling(false);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!shouldAnimateTodoBell(activeCount, prefersReducedMotion)) return;

    let timeoutId: number | undefined;
    const intervalId = window.setInterval(() => {
      setWiggling(true);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setWiggling(false), 1000);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [activeCount]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={
          hasUnreadNotifications
            ? `${translate(language, "notifications.bell.title")}: ${unreadCount}`
            : hasTodos
              ? `${translate(language, "todo.bell.title")}: ${todoCount}`
              : translate(language, "notifications.empty")
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`relative grid h-10 w-10 place-items-center rounded-xl border transition ${
          hasUnreadNotifications
            ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
            : hasTodos
              ? "border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
        } ${wiggling ? "animate-todo-bell-wiggle" : ""}`}
      >
        <BellIcon className={`h-5 w-5 ${hasActivity ? "fill-current" : ""}`} />
        {hasActivity && (
          <span className={`absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold leading-5 text-white ring-2 ring-white ${
            hasUnreadNotifications ? "bg-rose-600" : "bg-brand-700"
          }`}>
            {activeCount > 99 ? "99+" : activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-sm font-bold text-slate-950">{translate(language, "notifications.bell.title")}</p>
            {hasUnreadNotifications ? (
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <ListChecks className="h-3.5 w-3.5" />
                {translate(language, "notifications.markAllRead")}
              </button>
            ) : hasTodos ? (
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                {todoCount} {translate(language, "todo.bell.openCount")}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                0
              </span>
            )}
          </div>
          <div className="max-h-[26rem] overflow-y-auto p-2">
            {notifications.length > 0 && (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <HeaderNotificationRow
                    key={notification.id}
                    notification={notification}
                    language={language}
                    onOpen={() => {
                      setOpen(false);
                      void openNotification(notification);
                    }}
                  />
                ))}
              </div>
            )}
            {hasTodos && (
              <div className={notifications.length > 0 ? "mt-2 border-t border-slate-100 pt-2" : ""}>
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {translate(language, "todo.bell.title")}
                </p>
                <div className="space-y-1">
                  {todoItems.map((item) => (
                    <HeaderTodoRow
                      key={`${item.todoKind}-${item.id}`}
                      item={item}
                      language={language}
                      onOpen={() => setOpen(false)}
                    />
                  ))}
                </div>
              </div>
            )}
            {!notifications.length && !hasTodos && (
              <p className="px-3 py-5 text-center text-sm text-slate-500">
                {translate(language, "notifications.empty")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderNotificationRow({
  language,
  notification,
  onOpen,
}: {
  language: MockUser["language"];
  notification: AppNotification;
  onOpen: () => void;
}) {
  const unread = !notification.isRead;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-[72px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 ${
        unread ? "bg-rose-50/70" : ""
      }`}
    >
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
        unread ? "bg-rose-100 text-rose-700" : "bg-brand-50 text-brand-700"
      }`}>
        <ClipboardCheck className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${
          unread ? "text-rose-700" : "text-brand-700"
        }`}>
          {unread ? translate(language, "notifications.unread") : translate(language, "notifications.read")}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">
          {notificationTitle(notification, language)}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
          {notificationBody(notification, language)}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs text-slate-400">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{formatNotificationDate(notification.createdAt, language)}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  );
}

function HeaderTodoRow({
  item,
  language,
  onOpen,
}: {
  item: HeaderTodoItem;
  language: MockUser["language"];
  onOpen: () => void;
}) {
  const Icon = todoIcons[item.type];
  const actionLabel = item.todoKind === "approval"
    ? translate(language, "todo.action.approvalRequested")
    : translate(language, "todo.action.execute");
  const primaryText = item.todoKind === "approval"
    ? translate(language, "todo.description.approvalRequested")
    : item.title;
  const detailParts = [
    item.todoKind === "approval" ? item.title : item.subtitle,
    item.owner,
    formatTodoDate(item.date, language),
    item.timeLabel,
    todoStatusLabel(item.status, language),
  ].filter(Boolean);
  const content = (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">
          {todoTypeLabel(item.type, language)} · {actionLabel}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-950">{primaryText}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{detailParts.join(" · ")}</span>
        </p>
      </div>
      {item.href && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
    </>
  );
  const className = "flex min-h-[68px] items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50";

  if (item.href) {
    return (
      <Link href={item.href} onClick={onOpen} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function todoTypeLabel(type: DashboardAttentionType, language: MockUser["language"]) {
  return translate(language, `todo.type.${type}` as TranslationKey);
}

function todoStatusLabel(status: string, language: MockUser["language"]) {
  const key = `status.${status}` as TranslationKey;
  const label = translate(language, key);
  return label === key ? status.replaceAll("_", " ") : label;
}

function formatTodoDate(value: string, language: MockUser["language"]) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

function formatNotificationDate(value: string, language: MockUser["language"]) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
        active ? "bg-white text-brand-800 shadow-sm" : "text-blue-100 hover:bg-white/10 hover:text-white"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

