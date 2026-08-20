"use client";

import { Fragment, useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Contact, UsersRound, X } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/ui";
import { translate, type TranslationKey } from "@/lib/i18n";

export type SalesDayTeamAppointment = {
  id: string;
  sequence: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  outcomeReasonExternalId?: string | null;
  relation: {
    displayName: string;
    type: string;
    externalLinks: Array<{ externalId: string }>;
    contacts: Array<{ name: string; phone?: string | null; mobile?: string | null }>;
    addresses: Array<{ street: string; houseNumber?: string | null; postalCode: string; city: string }>;
  };
  salesDocuments: Array<{
    id: string;
    documentNumber: string;
    documentType: string;
    status: string;
    amountIncludingVat: string;
    currency: string;
    paymentMethodExternalId?: string | null;
  }>;
};

export type SalesDayTeamMember = {
  id: string;
  representativeId?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  country: string;
  team?: { id: string; name: string; country: string } | null;
  appointmentCount: number;
  completedCount: number;
  unresolvedCount: number;
  appointments: SalesDayTeamAppointment[];
};

type TeamLanguage = "nl" | "fr" | "de";

export function SalesDayTeamWorkspace({ members, businessDate, date, language, onDateChange }: { members: SalesDayTeamMember[]; businessDate?: string; date?: string; language: TeamLanguage; onDateChange: (date: string) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const [teamFilter, setTeamFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | undefined>();
  const [summaryAppointment, setSummaryAppointment] = useState<SalesDayTeamAppointment>();
  const teams = [...new Set(members.map((member) => member.team?.name).filter(Boolean) as string[])].sort();
  const countries = [...new Set(members.map((member) => member.country))].sort();
  const visibleMembers = members
    .filter((member) => teamFilter === "all" || member.team?.name === teamFilter)
    .filter((member) => countryFilter === "all" || member.country === countryFilter)
    .sort((left, right) => `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`, language));
  const summary = summarize(visibleMembers);
  const selectedDate = date ?? businessDate ?? "";

  if (!members.length) return <EmptyState title={t("salesday.team.emptyTitle")} description={t("salesday.team.emptyDescription")} />;

  return <section className="grid gap-3">
    <div className="card border-brand-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-brand-50 px-4 py-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand-100 text-brand-700"><UsersRound className="h-6 w-6" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1"><p className="eyebrow">{t("salesday.team.title")}</p><h2 className="truncate text-xl font-black text-slate-950">{t("salesday.nav.team")}</h2><p className="truncate text-xs font-semibold text-slate-500">{t("salesday.team.subtitle")}</p></div>
      </div>
    </div>

    <div className={`card grid gap-3 p-3 ${countries.length > 1 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      <label className="grid gap-1"><span className="text-xs font-bold text-slate-600">{t("salesday.team.filter.date")}</span><input className="input min-h-9" type="date" value={selectedDate} onChange={(event) => onDateChange(event.target.value)} /></label>
      <label className="grid gap-1"><span className="text-xs font-bold text-slate-600">{t("salesday.team.filter.team")}</span><select className="input min-h-9" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">{t("salesday.team.filter.allTeams")}</option>{teams.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
      {countries.length > 1 && <label className="grid gap-1"><span className="text-xs font-bold text-slate-600">{t("salesday.team.filter.country")}</span><select className="input min-h-9" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">{t("salesday.team.filter.allCountries")}</option>{countries.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>}
    </div>

    <div className="grid gap-3 md:grid-cols-5">
      <SummaryMetric icon={CalendarDays} label={t("salesday.team.summary.appointments")} value={String(summary.appointments)} />
      <SummaryMetric icon={CheckCircle2} label={t("salesday.team.summary.completed")} value={String(summary.completed)} />
      <SummaryMetric icon={Clock3} label={t("salesday.team.summary.todo")} value={String(summary.todo)} />
      <SummaryMetric icon={ClipboardCheck} label={t("salesday.team.summary.orders")} value={formatCurrency(summary.orderTurnover, language)} />
      <SummaryMetric icon={Contact} label={t("salesday.team.summary.invoices")} value={formatCurrency(summary.invoiceTurnover, language)} />
    </div>

    <article className="card p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
      <p className="mb-3 text-center text-sm font-semibold text-brand-700">{t("salesday.team.clickForDetails")}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[64rem] border-separate border-spacing-0 text-left text-sm">
        <thead><tr className="text-slate-500"><th className="border-b border-slate-200 py-3 pl-3 pr-3"></th><th className="border-b border-slate-200 py-3 pr-4">{t("salesday.team.column.representative")}</th><th className="border-b border-slate-200 py-3 pr-4 text-center">{t("salesday.team.column.appointments")}</th><th className="border-b border-slate-200 py-3 pr-4 text-center">{t("salesday.team.column.customers")}</th><th className="border-b border-slate-200 py-3 pr-4 text-center">{t("salesday.team.column.prospects")}</th><th className="border-b border-slate-200 py-3 pr-4 text-center">{t("salesday.team.column.completed")}</th><th className="border-b border-slate-200 py-3 pr-4 text-center">{t("salesday.team.column.todo")}</th><th className="border-b border-slate-200 py-3 pr-4 text-center">{t("salesday.team.column.orderTurnover")}</th><th className="border-b border-slate-200 py-3 text-center">{t("salesday.team.column.invoiceTurnover")}</th></tr></thead>
        <tbody>{visibleMembers.map((member) => {
          const rowSummary = summarize([member]);
          const expanded = member.id === expandedId;
          return <Fragment key={member.id}><tr className="cursor-pointer transition hover:bg-brand-50/70" onClick={() => setExpandedId(expanded ? undefined : member.id)}><td className="border-b border-slate-100 py-2 pl-3 pr-3"><TeamAvatar member={member} /></td><td className="border-b border-slate-100 py-3 pr-4 font-black text-slate-950">{member.firstName} {member.lastName}</td><td className="border-b border-slate-100 py-3 pr-4 text-center">{rowSummary.appointments}</td><td className="border-b border-slate-100 py-3 pr-4 text-center">{rowSummary.customers}</td><td className="border-b border-slate-100 py-3 pr-4 text-center">{rowSummary.prospects}</td><td className="border-b border-slate-100 py-3 pr-4 text-center">{rowSummary.completed}</td><td className="border-b border-slate-100 py-3 pr-4 text-center">{rowSummary.todo}</td><td className="border-b border-slate-100 py-3 pr-4 text-center font-semibold">{formatCurrency(rowSummary.orderTurnover, language)}</td><td className="border-b border-slate-100 py-3 text-center font-semibold">{formatCurrency(rowSummary.invoiceTurnover, language)}</td></tr>{expanded && <tr><td className="border-b border-slate-100 bg-slate-50 p-4" colSpan={9}><AppointmentDetailTable appointments={member.appointments} language={language} onOpenSummary={setSummaryAppointment} /></td></tr>}</Fragment>;
        })}</tbody>
      </table></div>
    </article>
    {summaryAppointment && <AppointmentSummaryModal appointment={summaryAppointment} language={language} onClose={() => setSummaryAppointment(undefined)} />}
  </section>;
}

function AppointmentDetailTable({ appointments, language, onOpenSummary }: { appointments: SalesDayTeamAppointment[]; language: TeamLanguage; onOpenSummary: (appointment: SalesDayTeamAppointment) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <table className="w-full min-w-[54rem] border-separate border-spacing-0 text-left text-xs"><thead><tr className="text-slate-500"><th className="border-b border-slate-200 py-2 pr-3">{t("salesday.team.detail.time")}</th><th className="border-b border-slate-200 py-2 pr-3">{t("salesday.team.detail.number")}</th><th className="border-b border-slate-200 py-2 pr-3">{t("salesday.team.detail.name")}</th><th className="border-b border-slate-200 py-2 pr-3 text-center">{t("salesday.team.detail.type")}</th><th className="border-b border-slate-200 py-2 pr-3 text-center">{t("salesday.team.detail.status")}</th><th className="border-b border-slate-200 py-2 pr-3 text-center">{t("salesday.team.detail.orderTurnover")}</th><th className="border-b border-slate-200 py-2 pr-3 text-center">{t("salesday.team.detail.invoiceTurnover")}</th><th className="border-b border-slate-200 py-2">{t("salesday.team.detail.action")}</th></tr></thead><tbody>{[...appointments].sort((left, right) => (left.startsAt ?? "").localeCompare(right.startsAt ?? "")).map((appointment) => { const relation = appointment.relation; return <tr key={appointment.id}><td className="border-b border-slate-200 py-2 pr-3 font-black">{formatTime(appointment.startsAt, language)}</td><td className="border-b border-slate-200 py-2 pr-3">{relation.externalLinks[0]?.externalId ?? "-"}</td><td className="border-b border-slate-200 py-2 pr-3 font-semibold">{relation.displayName}</td><td className="border-b border-slate-200 py-2 pr-3 text-center"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${relation.type === "PROSPECT" ? "bg-amber-100 text-amber-800" : "bg-cyan-100 text-cyan-800"}`}>{relation.type === "PROSPECT" ? t("salesday.agenda.prospect") : t("salesday.agenda.customer")}</span></td><td className="border-b border-slate-200 py-2 pr-3 text-center"><StatusBadge status={appointment.status.toLowerCase()} label={appointmentStatusLabel(appointment, t)} /></td><td className="border-b border-slate-200 py-2 pr-3 text-center">{formatCurrency(documentTotal(appointment, "ORDER"), language)}</td><td className="border-b border-slate-200 py-2 pr-3 text-center">{formatCurrency(documentTotal(appointment, "INVOICE"), language)}</td><td className="border-b border-slate-200 py-2"><button className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand-700 px-3 text-xs font-bold text-white transition hover:bg-brand-800" type="button" onClick={(event) => { event.stopPropagation(); onOpenSummary(appointment); }}><ArrowUpRight className="h-4 w-4" aria-hidden="true" />{t("salesday.agenda.openAppointment")}</button></td></tr>; })}</tbody></table>;
}

function AppointmentSummaryModal({ appointment, language, onClose }: { appointment: SalesDayTeamAppointment; language: TeamLanguage; onClose: () => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const address = appointment.relation.addresses[0];
  const contact = appointment.relation.contacts[0];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">{t("salesday.team.modal.eyebrow")}</p><h3 className="mt-1 text-xl font-black text-slate-950">{appointment.relation.displayName}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{formatTime(appointment.startsAt, language)} · {appointment.relation.externalLinks[0]?.externalId ?? "-"} · {appointment.relation.type === "PROSPECT" ? t("salesday.agenda.prospect") : t("salesday.agenda.customer")}</p></div><button className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800" type="button" onClick={onClose}><X className="mr-1 inline h-4 w-4" aria-hidden="true" />{t("salesday.team.modal.close")}</button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><SummaryField label={t("salesday.team.modal.status")} value={appointmentStatusLabel(appointment, t)} /><SummaryField label={t("salesday.team.modal.address")} value={address ? `${address.street}${address.houseNumber ? ` ${address.houseNumber}` : ""}, ${address.postalCode} ${address.city}` : "-"} /><SummaryField label={t("salesday.team.modal.orderTurnover")} value={formatCurrency(documentTotal(appointment, "ORDER"), language)} /><SummaryField label={t("salesday.team.modal.invoiceTurnover")} value={formatCurrency(documentTotal(appointment, "INVOICE"), language)} /><SummaryField label={t("salesday.team.modal.contact")} value={contact?.name ?? "-"} /><SummaryField label={t("salesday.team.modal.phone")} value={contact?.phone ?? contact?.mobile ?? "-"} /></div><div className="mt-5"><h4 className="text-sm font-black uppercase text-slate-600">{t("salesday.team.modal.documents")}</h4><table className="mt-2 w-full border-separate border-spacing-0 text-left text-sm"><thead><tr className="text-slate-500"><th className="border-b border-slate-200 py-2 pr-3">{t("salesday.team.modal.documentType")}</th><th className="border-b border-slate-200 py-2 pr-3">{t("salesday.team.modal.documentNumber")}</th><th className="border-b border-slate-200 py-2 pr-3">{t("salesday.team.modal.amount")}</th><th className="border-b border-slate-200 py-2">{t("salesday.team.modal.payment")}</th></tr></thead><tbody>{appointment.salesDocuments.map((document) => <tr key={document.id}><td className="border-b border-slate-100 py-2 pr-3 font-bold">{documentTypeLabel(document.documentType, t)}</td><td className="border-b border-slate-100 py-2 pr-3">{document.documentNumber}</td><td className="border-b border-slate-100 py-2 pr-3 font-semibold">{formatCurrency(Number(document.amountIncludingVat), language)}</td><td className="border-b border-slate-100 py-2">{document.paymentMethodExternalId ?? "-"}</td></tr>)}</tbody></table></div></section></div>;
}

function SummaryField({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-950">{value}</p></div>; }
function SummaryMetric({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="card border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div></div></div>; }
function TeamAvatar({ member }: { member: SalesDayTeamMember }) {
  const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`;
  if (!member.avatarUrl) return <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Avatar URL is an existing user-provided profile image.
    <img className="h-8 w-8 rounded-full object-cover" src={member.avatarUrl} alt={`${member.firstName} ${member.lastName}`} />
  );
}
function summarize(members: SalesDayTeamMember[]) { const appointments = members.flatMap((member) => member.appointments); return { appointments: appointments.length, customers: appointments.filter((appointment) => appointment.relation.type !== "PROSPECT").length, prospects: appointments.filter((appointment) => appointment.relation.type === "PROSPECT").length, completed: appointments.filter((appointment) => appointment.status === "COMPLETED").length, todo: appointments.filter((appointment) => appointment.status !== "COMPLETED").length, orderTurnover: appointments.reduce((total, appointment) => total + documentTotal(appointment, "ORDER"), 0), invoiceTurnover: appointments.reduce((total, appointment) => total + documentTotal(appointment, "INVOICE"), 0) }; }
function documentTotal(appointment: SalesDayTeamAppointment, type: "ORDER" | "INVOICE") { return appointment.salesDocuments.filter((document) => type === "ORDER" ? ["ORDER", "ORDER_ALREADY_DELIVERED"].includes(document.documentType) : document.documentType === "INVOICE").reduce((total, document) => total + Number(document.amountIncludingVat), 0); }
function appointmentStatusLabel(appointment: SalesDayTeamAppointment, t: (key: TranslationKey) => string) { if (appointment.status === "PLANNED") return t("salesday.agenda.planned"); if (appointment.status === "COMPLETED") return t("salesday.agenda.completed"); if (appointment.status === "NOT_COMPLETED") return t("salesday.agenda.noTime"); if (appointment.status === "MOVED") return t("salesday.agenda.moved"); return t("salesday.agenda.cancelled"); }
function documentTypeLabel(type: string, t: (key: TranslationKey) => string) { if (type === "ORDER") return t("salesday.agenda.order"); if (type === "ORDER_ALREADY_DELIVERED") return t("salesday.team.modal.deliveredOrder"); return t("salesday.agenda.invoice"); }
function formatTime(value: string | null, language: TeamLanguage) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE", { hour: "2-digit", minute: "2-digit" }); }
function formatCurrency(value: number, language: TeamLanguage) { return new Intl.NumberFormat(language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value); }
