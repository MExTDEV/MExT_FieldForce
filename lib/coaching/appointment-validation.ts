import type { CoachingAppointment } from "@/lib/types";

export type CoachingAppointmentIssue =
  | "customer_required"
  | "customer_number_required"
  | "place_required"
  | "arrival_time_required"
  | "departure_time_required"
  | "time_range_invalid"
  | "score_required";

export function coachingAppointmentIssues(
  appointment: Pick<
    CoachingAppointment,
    "customer" | "customerNumber" | "place" | "arrivalTime" | "departureTime" | "scores"
  >
): CoachingAppointmentIssue[] {
  const issues: CoachingAppointmentIssue[] = [];
  if (!appointment.customer.trim()) issues.push("customer_required");
  if (!appointment.customerNumber?.trim()) issues.push("customer_number_required");
  if (!appointment.place?.trim()) issues.push("place_required");

  const arrivalTimeValid = isValidTime(appointment.arrivalTime);
  const departureTimeValid = isValidTime(appointment.departureTime);
  if (!arrivalTimeValid) issues.push("arrival_time_required");
  if (!departureTimeValid) issues.push("departure_time_required");
  if (
    arrivalTimeValid &&
    departureTimeValid &&
    appointment.departureTime <= appointment.arrivalTime
  ) {
    issues.push("time_range_invalid");
  }

  if (
    appointment.scores.length === 0 ||
    appointment.scores.some((score) => score.score === null || score.score === undefined)
  ) {
    issues.push("score_required");
  }
  return issues;
}

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
