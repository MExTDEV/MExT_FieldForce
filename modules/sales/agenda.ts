import type { EntityRef } from "../contracts";

export type SalesAppointmentStatus =
  | "planned"
  | "completed"
  | "no_time"
  | "cancelled"
  | "customer_absent"
  | "rescheduled";

export type SalesAppointment = {
  id: string;
  time: string;
  status: SalesAppointmentStatus;
  statusChangedAt?: string | null;
  customer?: EntityRef<"customer"> | null;
  prospect?: EntityRef<"prospect"> | null;
};

export type SalesAgendaCounters = {
  total: number;
  open: number;
  closed: number;
  noTime: number;
  customerAbsent: number;
};

export type SalesAgendaSections = {
  open: SalesAppointment[];
  closed: SalesAppointment[];
  counters: SalesAgendaCounters;
};

const openStatuses = new Set<SalesAppointmentStatus>(["planned", "rescheduled"]);
const closedStatuses = new Set<SalesAppointmentStatus>([
  "completed",
  "no_time",
  "customer_absent",
  "cancelled",
]);

export function buildSalesAgendaSections(
  appointments: readonly SalesAppointment[]
): SalesAgendaSections {
  const open = appointments
    .filter((item) => openStatuses.has(item.status))
    .sort((left, right) => left.time.localeCompare(right.time));

  const closed = appointments
    .filter((item) => closedStatuses.has(item.status))
    .sort(sortClosedAppointments);

  return {
    open,
    closed,
    counters: {
      total: appointments.length,
      open: open.length,
      closed: closed.length,
      noTime: appointments.filter((item) => item.status === "no_time").length,
      customerAbsent: appointments.filter(
        (item) => item.status === "customer_absent"
      ).length,
    },
  };
}

function sortClosedAppointments(
  left: SalesAppointment,
  right: SalesAppointment
) {
  const leftDate = left.statusChangedAt
    ? Date.parse(left.statusChangedAt)
    : Number.NaN;
  const rightDate = right.statusChangedAt
    ? Date.parse(right.statusChangedAt)
    : Number.NaN;

  if (
    !Number.isNaN(leftDate) &&
    !Number.isNaN(rightDate) &&
    rightDate !== leftDate
  ) {
    return rightDate - leftDate;
  }

  return right.time.localeCompare(left.time);
}
