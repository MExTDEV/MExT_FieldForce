"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Contact,
  GraduationCap,
  LayoutDashboard,
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
import { useState } from "react";
import {
  canAccessTechnicalManagement,
  canAccessUserManagement,
  roleLabels,
} from "@/lib/permissions";
import { translate, type TranslationKey } from "@/lib/i18n";
import { useSession } from "@/components/session-provider";
import { useModules } from "@/components/module-provider";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { branding } from "@/config/branding";
import { appModuleRegistry } from "@/lib/modules";

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

const manageNav = [
  { href: "/beheer/gebruikers", key: "nav.users", icon: UserCog },
  { href: "/beheer/teams", key: "nav.teams", icon: UsersRound },
  { href: "/beheer/rollen", key: "nav.roles", icon: ShieldCheck },
  { href: "/beheer/kpis", key: "nav.kpis", icon: BarChart3 },
  { href: "/beheer/kapstok", key: "nav.framework", icon: MessageSquareText },
  { href: "/beheer/modules", key: "nav.modules", icon: Settings },
  { href: "/beheer/instellingen", key: "nav.settings", icon: Settings },
] as const;

const representativeNav = [
  { href: "/mijn-reflecties", key: "nav.myReflections", icon: MessageSquareText },
  { href: "/mijn-verslagen", key: "nav.myReports", icon: ClipboardCheck },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, users, language, setLanguage, setUserId } = useSession();
  const { isModuleEnabled } = useModules();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const canSeeManagement = canAccessTechnicalManagement(user);
  const canSeeUsers = canAccessUserManagement(user);
  const activeModuleNav = appModuleRegistry
    .filter((module) => isModuleEnabled(module.code))
    .map((module) => ({
      href: module.href,
      key: module.navKey,
      icon: iconMap[module.icon as keyof typeof iconMap] ?? LayoutDashboard,
    }));
  const mainNav = [dashboardNav, ...activeModuleNav];

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
            <div className="flex h-14 w-[190px] items-center justify-center overflow-hidden rounded-xl bg-white px-2 py-1 shadow-sm">
              <Image
                src={branding.logoPath}
                alt={branding.fullAppName}
                width={1774}
                height={887}
                priority
                className="h-12 w-full object-contain"
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
        {user.role === "REPRESENTATIVE" && isModuleEnabled("ACTIEPUNTEN") && representativeNav.map((item) => (
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
        {canSeeUsers && (
          <>
            {!collapsed && <p className="px-3 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">Beheer</p>}
            {manageNav.filter((item) => canSeeManagement || item.href === "/beheer/gebruikers").map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={translate(language, item.key as TranslationKey)}
                active={pathname === item.href}
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

            <label className="relative flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-700 text-xs font-bold text-white">
                {user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{roleLabels[user.role]} · {user.country}</p>
              </div>
              <select
                value={user.id}
                onChange={(event) => setUserId(event.target.value)}
                aria-label="Mock gebruiker wisselen"
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {users.map((mockUser) => (
                  <option key={mockUser.id} value={mockUser.id}>
                    {mockUser.name} — {roleLabels[mockUser.role]}
                  </option>
                ))}
              </select>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
            </label>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 pb-24 sm:p-6 lg:p-8">{children}</main>
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
