import { representatives } from "@/lib/mock-data";
import { canAccessRepresentativeData } from "@/lib/data-access";
import type {
  MockUser,
  PersonalCoachingCriterion,
  Representative,
} from "@/lib/types";

export type PersonalCriterionInput = {
  title: string;
  description: string;
  focusName: string;
  representativeId: string;
};

export function createPersonalCriterionId() {
  return `personal-criterion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function representativeForCriterion(
  criterion: Pick<PersonalCoachingCriterion, "representativeId">
) {
  return representatives.find((item) => item.id === criterion.representativeId);
}

export function canViewPersonalCriterion(
  actor: MockUser,
  criterion: PersonalCoachingCriterion
) {
  const representative = representativeForCriterion(criterion);
  if (!representative) return false;
  if (!canAccessRepresentativeData(actor, representative)) return false;

  if (actor.role === "REPRESENTATIVE") {
    return criterion.representativeId === actor.representativeId;
  }
  if (actor.role === "SALES_LEADER") {
    return (
      representative.teamId === actor.teamId &&
      criterion.createdByUserId === actor.id
    );
  }
  if (actor.role === "COUNTRY_MANAGER") {
    return representative.country === actor.country;
  }
  return ["GROUP_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(actor.role);
}

export function canManagePersonalCriterionForRepresentative(
  actor: MockUser,
  representative: Representative
) {
  if (!canAccessRepresentativeData(actor, representative)) return false;
  if (actor.role === "SALES_LEADER") {
    return representative.teamId === actor.teamId;
  }
  return ["ADMIN", "SUPER_ADMIN"].includes(actor.role);
}

export function canManagePersonalCriterion(
  actor: MockUser,
  criterion: PersonalCoachingCriterion
) {
  const representative = representativeForCriterion(criterion);
  if (!representative) return false;
  if (!canManagePersonalCriterionForRepresentative(actor, representative)) {
    return false;
  }
  if (actor.role === "SALES_LEADER") {
    return criterion.createdByUserId === actor.id;
  }
  return ["ADMIN", "SUPER_ADMIN"].includes(actor.role);
}

export function visiblePersonalCriteria(
  actor: MockUser,
  criteria: PersonalCoachingCriterion[]
) {
  return criteria.filter((criterion) => canViewPersonalCriterion(actor, criterion));
}

export function activePersonalCriteriaForRepresentative(
  actor: MockUser,
  representativeId: string,
  criteria: PersonalCoachingCriterion[]
) {
  return visiblePersonalCriteria(actor, criteria).filter(
    (criterion) =>
      criterion.representativeId === representativeId && criterion.isActive
  );
}

export function validatePersonalCriterionInput(
  actor: MockUser,
  criteria: PersonalCoachingCriterion[],
  input: PersonalCriterionInput,
  editingId?: string
) {
  const representative = representatives.find(
    (item) => item.id === input.representativeId
  );
  if (!representative) return "Selecteer een geldige vertegenwoordiger.";
  if (!canManagePersonalCriterionForRepresentative(actor, representative)) {
    return "Je mag geen criteria beheren voor deze vertegenwoordiger.";
  }
  if (!input.title.trim()) return "Naam of titel van het criterium is verplicht.";
  if (!input.focusName.trim()) return "Koppel het criterium aan een kapstokfase.";

  const duplicate = criteria.some(
    (criterion) =>
      criterion.id !== editingId &&
      criterion.isActive &&
      criterion.representativeId === input.representativeId &&
      criterion.title.trim().toLowerCase() === input.title.trim().toLowerCase()
  );
  if (duplicate) {
    return "Er bestaat al een actief persoonlijk criterium met deze naam voor deze vertegenwoordiger.";
  }
  return undefined;
}
