import { coachingFramework, representatives } from "@/lib/mock-data";
import type { Representative, WorkflowActionPoint } from "@/lib/types";

export const generalCompetencies = [
  "Stiptheid",
  "Voorbereiding",
  "Administratie",
  "Tempo",
  "Zelfzekerheid",
  "Overtuigingskracht",
  "Respect",
  "Persoonlijke verzorging",
] as const;

export type PerformanceDimension = {
  label: string;
  score: number;
};

export type HistoricalCoaching = {
  id: string;
  representativeId: string;
  date: string;
  ownerId: string;
  ownerName: string;
  status: "afgesloten";
  focusNames: string[];
  phaseScores: PerformanceDimension[];
  generalScores: PerformanceDimension[];
  criterionScores: {
    focus: string;
    criterion: string;
    score: number;
  }[];
};

export type HistoricalContactMoment = {
  id: string;
  representativeId: string;
  date: string;
  ownerId: string;
  reason: string;
  status: "afgesloten";
};

export type HistoricalActionPoint = {
  id: string;
  representativeId: string;
  title: string;
  type: WorkflowActionPoint["type"];
  status: WorkflowActionPoint["status"] | "achterstallig";
  due: string;
  progress: number;
  updatedAt: string;
};

export type MonthlyKpiSnapshot = {
  id: string;
  representativeId: string;
  month: string;
  values: {
    label: string;
    value: number;
    target: number;
    unit: "%" | "EUR" | "number";
  }[];
};

const coachingDates = [
  "2025-07-18",
  "2025-09-12",
  "2025-11-14",
  "2026-01-16",
  "2026-03-20",
  "2026-05-15",
];

const kpiMonths = [
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
];

const actionTitles = [
  "Meer open vragen stellen",
  "Koppelverkoop consequent voorstellen",
  "Bezwaren actief samenvatten",
  "Dagplanning vooraf voorbereiden",
  "Tablet bij elke afsluiting gebruiken",
  "PV verhogen naar target",
  "Demonstratie interactiever maken",
  "Ordercontrole afronden bij de klant",
];

const teamCoaches = [
  { id: "user-leader-be", name: "Sophie Vermeulen", teamIds: ["be-1"] },
  { id: "leader-be-2", name: "Thomas Martens", teamIds: ["be-2", "be-3"] },
  { id: "leader-nl-1", name: "Eva De Vries", teamIds: ["nl-1", "nl-2", "nl-3"] },
  { id: "leader-de-1", name: "Felix Bauer", teamIds: ["de-1", "de-2"] },
  { id: "leader-de-2", name: "Nina Hoffmann", teamIds: ["de-3", "de-4"] },
];

export const historicalCoachings: HistoricalCoaching[] = representatives.flatMap((representative, representativeIndex) => {
  const profile = representativeIndex % 4;
  const owner = teamCoaches.find((leader) => leader.teamIds.includes(representative.teamId));
  return coachingDates.map((date, coachingIndex) => {
    const phaseScores = coachingFramework.map((phase, phaseIndex) => {
      const generated = scoreFor(profile, representativeIndex, coachingIndex, phaseIndex);
      return {
        label: phase.name,
        score: isJonasComparison(representativeIndex, coachingIndex)
          ? clampScore(scoreFor(profile, representativeIndex, coachingIndex - 1, phaseIndex) + [10, -10, 0, 5, -5][phaseIndex])
          : generated,
      };
    });
    const generalScores = generalCompetencies.map((label, competencyIndex) => {
      const generated = scoreFor(profile, representativeIndex + 2, coachingIndex, competencyIndex + 1);
      return {
        label,
        score: isJonasComparison(representativeIndex, coachingIndex)
          ? clampScore(scoreFor(profile, representativeIndex + 2, coachingIndex - 1, competencyIndex + 1) + [5, -5, 0, 10, -10, 0, 5, -5][competencyIndex])
          : generated,
      };
    });
    return {
      id: `history-coaching-${representative.id}-${coachingIndex + 1}`,
      representativeId: representative.id,
      date,
      ownerId: owner?.id ?? "user-super",
      ownerName: owner?.name ?? "FieldForce Coach",
      status: "afgesloten" as const,
      focusNames: phaseScores
        .filter((_, phaseIndex) => (phaseIndex + coachingIndex + representativeIndex) % 3 !== 0)
        .map((item) => item.label),
      phaseScores,
      generalScores,
      criterionScores: coachingFramework.flatMap((phase, phaseIndex) =>
        phase.criteria.map((criterion, criterionIndex) => ({
          focus: phase.name,
          criterion,
          score: clampScore(phaseScores[phaseIndex].score + ((criterionIndex % 3) - 1) * 5),
        }))
      ),
    };
  });
});

export const historicalContactMoments: HistoricalContactMoment[] = representatives.flatMap(
  (representative) => {
    if (!["Professional", "Expert"].includes(representative.level)) return [];
    const owner = teamCoaches.find((leader) => leader.teamIds.includes(representative.teamId));
    return ["2025-10-08", "2026-04-10"].map((date, index) => ({
      id: `history-contact-${representative.id}-${index + 1}`,
      representativeId: representative.id,
      date,
      ownerId: owner?.id ?? "user-super",
      reason: index === 0 ? "KPI-opvolging en werkorganisatie" : "Voortgang actiepunten en commerciële focus",
      status: "afgesloten" as const,
    }));
  }
);

export const historicalActionPoints: HistoricalActionPoint[] = representatives.flatMap(
  (representative, representativeIndex) => {
    const count = 3 + (representativeIndex % 6);
    return Array.from({ length: count }, (_, actionIndex) => {
      const statusIndex = (representativeIndex + actionIndex) % 4;
      const status = (["behaald", "in_uitvoering", "niet_behaald", "achterstallig"] as const)[statusIndex];
      const dueMonth = 1 + ((representativeIndex + actionIndex * 2) % 6);
      return {
        id: `history-action-${representative.id}-${actionIndex + 1}`,
        representativeId: representative.id,
        title: actionTitles[(representativeIndex + actionIndex) % actionTitles.length],
        type: (["kpi", "vaardigheid", "gedrag"] as const)[actionIndex % 3],
        status,
        due: status === "achterstallig"
          ? `2026-0${Math.min(5, dueMonth)}-15`
          : `2026-${String(Math.min(9, dueMonth + 3)).padStart(2, "0")}-20`,
        progress: status === "behaald" ? 100 : status === "in_uitvoering" ? 55 : status === "niet_behaald" ? 30 : 40,
        updatedAt: `2026-05-${String(8 + actionIndex).padStart(2, "0")}`,
      };
    });
  }
);

export const monthlyKpiSnapshots: MonthlyKpiSnapshot[] = representatives.flatMap(
  (representative, representativeIndex) =>
    kpiMonths.map((month, monthIndex) => {
      const profile = representativeIndex % 4;
      const movement = profileMovement(profile, monthIndex);
      return {
        id: `kpi-${representative.id}-${month}`,
        representativeId: representative.id,
        month,
        values: [
          { label: "PV %", value: round(66 + representativeIndex + movement * 1.1), target: 80, unit: "%" as const },
          { label: "Sales / Day", value: round(1080 + representativeIndex * 24 + movement * 24), target: 1350, unit: "EUR" as const },
          { label: "Q %", value: round(40 + (representativeIndex % 7) + movement * 0.7), target: 50, unit: "%" as const },
          { label: "FM / Order", value: round(2.2 + (representativeIndex % 4) * 0.08 + movement * 0.035), target: 2.8, unit: "number" as const },
        ],
      };
    })
);

export function coachingsForRepresentative(representativeId: string) {
  return historicalCoachings
    .filter((item) => item.representativeId === representativeId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function coachingById(id: string) {
  return historicalCoachings.find((item) => item.id === id);
}

export function performanceTrend(representativeId: string): -1 | 0 | 1 {
  const coachings = coachingsForRepresentative(representativeId);
  if (coachings.length < 2) return 0;
  const current = average(coachings.at(-1)!.phaseScores.map((item) => item.score));
  const previous = average(coachings.at(-2)!.phaseScores.map((item) => item.score));
  const difference = current - previous;
  return difference >= 2 ? 1 : difference <= -2 ? -1 : 0;
}

export function latestHistoricalCoaching(representativeId: string) {
  return coachingsForRepresentative(representativeId).at(-1);
}

export function representativeForCoaching(coaching: HistoricalCoaching): Representative | undefined {
  return representatives.find((item) => item.id === coaching.representativeId);
}

function scoreFor(
  profile: number,
  representativeIndex: number,
  coachingIndex: number,
  dimensionIndex: number
) {
  const start = 48 + (representativeIndex % 5) * 5 + (dimensionIndex % 4) * 3;
  const movement = profileMovement(profile, coachingIndex);
  const variation = ((representativeIndex + dimensionIndex * 2 + coachingIndex) % 5 - 2) * 2;
  return clampScore(start + movement * 4 + variation);
}

function isJonasComparison(representativeIndex: number, coachingIndex: number) {
  return representativeIndex === 0 && coachingIndex === coachingDates.length - 1;
}

function profileMovement(profile: number, index: number) {
  if (profile === 0) return index;
  if (profile === 1) return Math.round(index * 0.25);
  if (profile === 2) return -index * 0.7;
  return [0, 2, -1, 3, 1, 4][index % 6];
}

function clampScore(value: number) {
  return Math.max(20, Math.min(100, Math.round(value / 5) * 5));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
