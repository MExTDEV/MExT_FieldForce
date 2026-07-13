import type { ContactMoment } from "@/lib/types";

export type ContactMomentOverviewFilter =
  | "all"
  | "today"
  | "future"
  | "draftReports"
  | "shared"
  | "cancelled"
  | "notCompleted";

export const contactMomentFilterOptions: Array<{
  value: ContactMomentOverviewFilter;
  label: string;
}> = [
  { value: "all", label: "Alle" },
  { value: "today", label: "Vandaag" },
  { value: "future", label: "Toekomstig" },
  { value: "draftReports", label: "Conceptverslagen" },
  { value: "shared", label: "Gedeeld" },
  { value: "cancelled", label: "Geannuleerd" },
  { value: "notCompleted", label: "Niet uitgevoerd" },
];

export function filterContactMoments(
  contacts: ContactMoment[],
  filter: ContactMomentOverviewFilter,
  todayKey = toLocalDateKey()
) {
  return contacts.filter((contact) => contactMomentMatchesFilter(contact, filter, todayKey));
}

export function contactMomentMatchesFilter(
  contact: ContactMoment,
  filter: ContactMomentOverviewFilter,
  todayKey = toLocalDateKey()
) {
  if (filter === "all") return true;
  if (filter === "today") return contact.plannedDate === todayKey;
  if (filter === "future") return Boolean(contact.plannedDate && contact.plannedDate > todayKey);
  if (filter === "draftReports") {
    return ["concept", "wacht_op_vt_input", "in_uitvoering"].includes(contact.status);
  }
  if (filter === "shared") return contact.status === "afgesloten";
  if (filter === "cancelled") return contact.status === "geannuleerd";
  return contact.status === "niet_uitgevoerd";
}

export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
