"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowUpRight,
  ChevronDown,
  ListChecks,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/session-provider";
import { useModules } from "@/components/module-provider";
import { roleLabels } from "@/lib/permissions";
import {
  getAvailableDomains,
  getDomainLandingHref,
  getDomainForPath,
  type AppSwitcherDomain,
  type AppSwitcherLink,
} from "@/lib/app-switcher";

export function AppSwitcherMenu() {
  const pathname = usePathname();
  const { user, users, setUserId } = useSession();
  const { modules } = useModules();
  const authenticatedMode = process.env.NEXT_PUBLIC_AUTH_MODE !== "demo";
  const demoUserSwitcherEnabled =
    !authenticatedMode && process.env.NEXT_PUBLIC_ENABLE_DEMO_USER_SWITCHER !== "false";
  const availableDomains = useMemo(() => getAvailableDomains(user, modules), [modules, user]);
  const [open, setOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<AppSwitcherDomain["key"]>(() =>
    getDomainForPath(pathname)
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSelectedDomain(getDomainForPath(pathname));
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeDomain = availableDomains.find((domain) => domain.key === selectedDomain) ?? availableDomains[0];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[240px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="app-switcher-menu"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-700 text-xs font-bold text-white">
          {user.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">
            {roleLabels[user.role]} · {user.country}
          </p>
        </div>
        <ChevronDown className={`hidden h-4 w-4 text-slate-400 sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={menuRef}
          id="app-switcher-menu"
          role="dialog"
          aria-label="Applicatie- en gebruikersmenu"
          className="fixed left-2 right-2 top-20 z-40 mx-auto max-h-[calc(100vh-6rem)] w-[min(920px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[min(920px,calc(100vw-2rem))]"
        >
          <div className="grid max-h-[calc(100vh-6rem)] grid-cols-1 overflow-auto md:grid-cols-[190px_minmax(0,1fr)_210px]">
            <section className="border-b border-slate-100 bg-slate-50/70 p-3 md:border-b-0 md:border-r md:border-slate-200">
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Applicaties</p>
              <div className="space-y-1">
                {availableDomains.map((domain) => {
                  const Icon = domain.icon;
                  const active = domain.key === activeDomain?.key;
                  return (
                    <Link
                      key={domain.key}
                      href={getDomainLandingHref(domain)}
                      onMouseEnter={() => setSelectedDomain(domain.key)}
                      onFocus={() => setSelectedDomain(domain.key)}
                      onClick={() => {
                        setSelectedDomain(domain.key);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                        active
                          ? "bg-white text-brand-800 shadow-sm ring-1 ring-slate-200"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-brand-700 text-white" : "bg-white text-brand-700 ring-1 ring-slate-200"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{domain.title}</p>
                        <p className="truncate text-[11px] text-slate-500">{domain.subtitle}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="min-h-0 border-b border-slate-100 p-4 md:border-b-0 md:border-r md:border-slate-200">
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-950">{activeDomain?.title ?? "Coaching"}</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Directe links</p>
              </div>
              {(activeDomain?.links.length ?? 0) > 0 ? (
                <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                  {activeDomain?.links.map((link) => (
                    <SwitcherLink key={link.href} link={link} onClose={() => setOpen(false)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Geen directe links beschikbaar
                </div>
              )}
            </section>

            <aside className="bg-slate-50/60 p-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-700 text-xs font-bold text-white">
                    {user.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{roleLabels[user.role]}</p>
                  </div>
                </div>

                {demoUserSwitcherEnabled && (
                  <label className="mt-4 block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Gebruiker wisselen</span>
                    <select
                      value={user.id}
                      onChange={(event) => setUserId(event.target.value)}
                      className="field w-full"
                    >
                      {users.map((mockUser) => (
                        <option key={mockUser.id} value={mockUser.id}>
                          {mockUser.name} — {roleLabels[mockUser.role]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="mt-3 border-t border-slate-100 pt-2">
                  <Link
                    href="/mijn-gegevens"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" />
                      Mijn gegevens
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/taken-vandaag"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-800"
                  >
                    <span className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4" />
                      Taken vandaag
                    </span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setOpen(false);
                    await signOut({ redirect: false });
                    window.location.assign("/login");
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-800"
                >
                  <X className="h-4 w-4" />
                  Uitloggen
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function SwitcherLink({
  link,
  onClose,
}: {
  link: AppSwitcherLink;
  onClose: () => void;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onClose}
      className="group flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-brand-800"
    >
      <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${link.tone ?? "bg-slate-100 text-slate-600"}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="truncate font-medium">{link.label}</span>
    </Link>
  );
}

