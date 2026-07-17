import type { HistoricalCoaching } from "@/lib/performance-data";

export const completedPreparationStatuses = new Set([
  "akkoord_door_vertegenwoordiger",
  "afgesloten",
  "gefinaliseerd",
  "gesloten",
  "voltooid",
]);

export type PreparationReferenceCandidate = {
  id: string;
  representativeId: string;
  date: string;
  ownerName: string;
  status: string;
};

export type PreparationReferenceOption = {
  id: string;
  date: string;
  ownerName: string;
  isLatest: boolean;
};

export type PreparationScoreRow = {
  id: string;
  category: string;
  criterion: string;
  score?: number;
  notApplicable: boolean;
  comment: string;
};

export type PreparationScoreGroup = {
  id: string;
  kind: "general" | "personality" | "phase" | "appointment";
  title: string;
  sequence?: number;
  rows: PreparationScoreRow[];
};

export type PreparationReferenceDetail = PreparationReferenceOption & {
  history: HistoricalCoaching;
  scoreGroups: PreparationScoreGroup[];
};

export type PreparationReferenceResponse = {
  options: PreparationReferenceOption[];
  selectedId?: string;
  selected?: PreparationReferenceDetail;
  latest?: PreparationReferenceDetail;
};

export function buildPreparationReferenceOptions(input: {
  representativeId: string;
  currentId?: string;
  today: string;
  candidates: PreparationReferenceCandidate[];
}) {
  const eligible = input.candidates
    .filter((candidate) =>
      candidate.id !== input.currentId &&
      candidate.representativeId === input.representativeId &&
      candidate.date <= input.today &&
      completedPreparationStatuses.has(candidate.status.toLocaleLowerCase("nl-BE"))
    )
    .sort((left, right) =>
      right.date.localeCompare(left.date) || right.id.localeCompare(left.id)
    );

  return eligible.map((candidate, index) => ({
    id: candidate.id,
    date: candidate.date,
    ownerName: candidate.ownerName,
    isLatest: index === 0,
  }));
}

export function resolvePreparationReferenceId(
  options: PreparationReferenceOption[],
  requestedId?: string | null,
  storedId?: string | null
) {
  const preferredId = requestedId || storedId;
  if (preferredId && options.some((option) => option.id === preferredId)) return preferredId;
  return options[0]?.id;
}

export function buildPreparationPdfSections<T extends { id: string }>(
  selected?: T,
  latest?: T
) {
  if (!selected && !latest) return [] as Array<{ kind: "selected" | "latest" | "combined"; detail: T }>;
  if (selected && latest && selected.id === latest.id) {
    return [{ kind: "combined" as const, detail: selected }];
  }
  return [
    ...(selected ? [{ kind: "selected" as const, detail: selected }] : []),
    ...(latest ? [{ kind: "latest" as const, detail: latest }] : []),
  ];
}
