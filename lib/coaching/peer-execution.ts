import type { Country, MockUser, RepresentativeLevel, Role } from "@/lib/types";
import { isPeerCoachingRepresentativeLevel } from "@/lib/representative-levels";

export type PeerCoachingUser = {
  id: string;
  role: Role;
  representativeLevel: RepresentativeLevel;
  active: boolean;
  country: Country;
  teamId?: string | null;
};

export type PeerCoachingPlanInput = {
  actor: Pick<MockUser, "id" | "role" | "country" | "countryAccess">;
  executor: PeerCoachingUser;
  target: PeerCoachingUser;
  deviationReason?: string | null;
};

export type PeerCoachingDeviation = {
  teamDeviation: boolean;
  countryDeviation: boolean;
  requiresReason: boolean;
};

const peerPlannerRoles = new Set<Role>([
  "GROUP_MANAGER",
  "SALES_MANAGER",
  "COUNTRY_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export function canRolePlanPeerCoaching(role: Role) {
  return peerPlannerRoles.has(role);
}

export function canExecutePeerCoaching(user: Pick<PeerCoachingUser, "role" | "representativeLevel" | "active">) {
  return user.active &&
    user.role === "REPRESENTATIVE" &&
    isPeerCoachingRepresentativeLevel(user.representativeLevel);
}

export function peerCoachingDeviation(executor: Pick<PeerCoachingUser, "country" | "teamId">, target: Pick<PeerCoachingUser, "country" | "teamId">): PeerCoachingDeviation {
  const teamDeviation = Boolean(executor.teamId && target.teamId && executor.teamId !== target.teamId);
  const countryDeviation = executor.country !== target.country;
  return {
    teamDeviation,
    countryDeviation,
    requiresReason: teamDeviation || countryDeviation,
  };
}

export function assertCanPlanPeerCoaching(input: PeerCoachingPlanInput) {
  if (!canRolePlanPeerCoaching(input.actor.role)) {
    throw new Error("Alleen Group Manager, Sales Manager, Country Manager, Admin of Super Admin mag een Professional/Expert als uitvoerder plannen.");
  }
  if (!canExecutePeerCoaching(input.executor)) {
    throw new Error("Alleen actieve vertegenwoordigers met niveau Professional of Expert mogen als uitvoerder worden aangeduid.");
  }
  if (input.target.role !== "REPRESENTATIVE") {
    throw new Error("Een collegiale begeleiding kan alleen voor een vertegenwoordiger worden gepland.");
  }
  if (input.executor.id === input.target.id) {
    throw new Error("Zelfbegeleiding is niet toegestaan.");
  }
  const deviation = peerCoachingDeviation(input.executor, input.target);
  if (deviation.requiresReason && !input.deviationReason?.trim()) {
    throw new Error("Geef een afwijkingsreden op wanneer uitvoerder en begeleide persoon niet in hetzelfde team en land zitten.");
  }
  return deviation;
}

export function assertPeerCoachCanStart(input: { executor: PeerCoachingUser; targetId: string; plannedDate: string; now: Date }) {
  if (!canExecutePeerCoaching(input.executor)) {
    throw new Error("Deze uitvoerder is geen actieve Professional of Expert meer en mag de begeleiding niet starten.");
  }
  if (input.executor.id === input.targetId) {
    throw new Error("Zelfbegeleiding is niet toegestaan.");
  }
  const today = dateOnlyInLocalTime(input.now);
  if (input.plannedDate > today) {
    throw new Error("Begeleiding starten kan pas vanaf 00:00 op de geplande kalenderdag.");
  }
}

export function assertCanReplacePeerCoach(input: { actualStartedAt?: Date | string | null; startedAt?: Date | string | null }) {
  if (input.actualStartedAt || input.startedAt) {
    throw new Error("De uitvoerder kan niet meer vervangen worden nadat de begeleiding gestart is.");
  }
}

function dateOnlyInLocalTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
