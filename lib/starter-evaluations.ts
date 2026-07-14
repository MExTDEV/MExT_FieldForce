import type {
  Country,
  CriterionScopeType,
  RepresentativeLevel,
} from "@/lib/types";

export type StarterEvaluationMoment = "MONTH_1_5" | "MONTH_3" | "MONTH_5";
export type StarterEvaluationAnswerType =
  | "SHORT_TEXT"
  | "RICH_TEXT"
  | "BOOLEAN"
  | "NUMBER"
  | "PERCENTAGE"
  | "CURRENCY"
  | "SCORE"
  | "CHOICE"
  | "DATE"
  | "SYSTEM"
  | "LINKED_CRITERION"
  | "ACTION_POINTS";
export type StarterEvaluationAssignee =
  | "REPRESENTATIVE"
  | "EVALUATOR"
  | "BOTH_SEPARATE"
  | "SYSTEM"
  | "SHARED_EVALUATOR";

export const starterEvaluationModuleCode = "TUSSENTIJDSE_EVALUATIES" as const;

export const starterEvaluationMoments: StarterEvaluationMoment[] = [
  "MONTH_1_5",
  "MONTH_3",
  "MONTH_5",
];

export const starterEvaluationMomentLabels: Record<StarterEvaluationMoment, string> = {
  MONTH_1_5: "1,5 maand",
  MONTH_3: "3 maanden",
  MONTH_5: "5 maanden",
};

export type StarterEvaluationScopeContext = {
  country: Country;
  teamId?: string | null;
  userId: string;
};

export type StarterEvaluationSectionSeed = {
  code: string;
  titleNl: string;
  sortOrder: number;
  active?: boolean;
  moments: StarterEvaluationMoment[];
};

export type StarterEvaluationQuestionSeed = {
  key: string;
  sectionCode: string;
  textNl: string;
  sortOrder: number;
  required?: boolean;
  active?: boolean;
  answerType: StarterEvaluationAnswerType;
  assignee: StarterEvaluationAssignee;
  moments: StarterEvaluationMoment[];
  scopeType?: CriterionScopeType;
  scopeKey?: string;
};

const allMoments = starterEvaluationMoments;

export const starterEvaluationSectionSeeds: StarterEvaluationSectionSeed[] = [
  { code: "job_expectations", titleNl: "Verwachtingen over de nieuwe job", sortOrder: 10, moments: allMoments },
  { code: "employee_topics", titleNl: "Thema's van de medewerker", sortOrder: 20, moments: allMoments },
  { code: "personal_workstyle", titleNl: "Persoonlijke werkwijze", sortOrder: 30, moments: allMoments },
  { code: "golden_mext_rules", titleNl: "Attitude / Golden MExT Rules", sortOrder: 40, moments: allMoments },
  { code: "coat_rack_evolution", titleNl: "Evolutie in het gebruik van de Kapstok", sortOrder: 50, moments: allMoments },
  { code: "performance_kpis", titleNl: "Evolutie op performancecriteria", sortOrder: 60, moments: allMoments },
  { code: "measure", titleNl: "Meetlat", sortOrder: 70, active: false, moments: allMoments },
  { code: "coaching_count", titleNl: "Aantal begeleidingen", sortOrder: 80, moments: allMoments },
  { code: "coaching_conclusions", titleNl: "Conclusies uit begeleidingen", sortOrder: 90, moments: allMoments },
  { code: "action_point_evolution", titleNl: "Evolutie van actiepunten", sortOrder: 100, moments: allMoments },
  { code: "previous_todo_realisation", titleNl: "Realisatie vorige todo", sortOrder: 110, moments: ["MONTH_3", "MONTH_5"] },
  { code: "next_period_todo", titleNl: "Todo voor de volgende periode", sortOrder: 120, moments: allMoments },
  { code: "expectation_alignment", titleNl: "Evolutie in lijn met de verwachtingen", sortOrder: 130, moments: allMoments },
  { code: "general_evaluation", titleNl: "Algemene evaluatie", sortOrder: 140, moments: allMoments },
];

export const starterEvaluationQuestionSeeds: StarterEvaluationQuestionSeed[] = [
  ...[
    "Hoe voel je je?",
    "Doe je het graag?",
    "Wat loopt goed?",
    "Wat valt minder mee?",
    "Waarmee kunnen we ondersteunen?",
    "Hoe zie je het verder?",
  ].map((textNl, index) => ({
    key: `job_expectations_${index + 1}`,
    sectionCode: "job_expectations",
    textNl,
    sortOrder: (index + 1) * 10,
    answerType: "RICH_TEXT" as const,
    assignee: "BOTH_SEPARATE" as const,
    moments: allMoments,
  })),
  {
    key: "employee_topics_open",
    sectionCode: "employee_topics",
    textNl: "Zijn er zaken die je wilt aankaarten?",
    sortOrder: 10,
    answerType: "RICH_TEXT",
    assignee: "REPRESENTATIVE",
    moments: allMoments,
  },
  ...[
    "Omgang met klanten",
    "Servicegerichtheid, waaronder klachten en retours",
    "Aan- en afwezigheid",
    "Interactie met collega's, waaronder TS, CB en VL",
  ].map((textNl, index) => ({
    key: `personal_workstyle_${index + 1}`,
    sectionCode: "personal_workstyle",
    textNl,
    sortOrder: (index + 1) * 10,
    answerType: "RICH_TEXT" as const,
    assignee: "BOTH_SEPARATE" as const,
    moments: allMoments,
  })),
  {
    key: "next_period_action_points",
    sectionCode: "next_period_todo",
    textNl: "Welke actiepunten worden voorbereid voor de volgende periode?",
    sortOrder: 10,
    answerType: "ACTION_POINTS",
    assignee: "EVALUATOR",
    moments: allMoments,
  },
  {
    key: "expectation_alignment_summary",
    sectionCode: "expectation_alignment",
    textNl: "Beschrijf de evolutie in lijn met de verwachtingen.",
    sortOrder: 10,
    answerType: "RICH_TEXT",
    assignee: "EVALUATOR",
    moments: allMoments,
  },
  {
    key: "general_evaluation_summary",
    sectionCode: "general_evaluation",
    textNl: "Algemene evaluatie",
    sortOrder: 10,
    answerType: "RICH_TEXT",
    assignee: "EVALUATOR",
    moments: allMoments,
  },
];

export function isStarterRepresentative(level: RepresentativeLevel | string | null | undefined) {
  return level === "STARTER";
}

export function calculateStarterEvaluationMilestones(startDate: Date) {
  const start = dateOnlyUtc(startDate);
  return {
    MONTH_1_5: addUtcDays(start, 42),
    MONTH_3: addUtcMonths(start, 3),
    MONTH_5: addUtcMonths(start, 5),
  } satisfies Record<StarterEvaluationMoment, Date>;
}

export function dueStarterEvaluationMoments(startDate: Date, referenceDate = new Date()) {
  const milestones = calculateStarterEvaluationMilestones(startDate);
  const reference = dateOnlyUtc(referenceDate);
  return starterEvaluationMoments.filter((moment) => milestones[moment] <= reference);
}

export function dateOnlyUtc(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return dateOnlyUtc(next);
}

function addUtcMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return dateOnlyUtc(next);
}

export function momentsJson(moments: StarterEvaluationMoment[]) {
  return JSON.stringify([...new Set(moments)]);
}

export function parseMomentsJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is StarterEvaluationMoment =>
          starterEvaluationMoments.includes(item as StarterEvaluationMoment)
        )
      : [];
  } catch {
    return [];
  }
}

export function scopePriority(scopeType: CriterionScopeType) {
  if (scopeType === "USER") return 4;
  if (scopeType === "TEAM") return 3;
  if (scopeType === "COUNTRY") return 2;
  return 1;
}

export function scopeApplies(
  item: { scopeType: CriterionScopeType; scopeKey: string },
  context: StarterEvaluationScopeContext
) {
  if (item.scopeType === "GLOBAL") return item.scopeKey === "GLOBAL";
  if (item.scopeType === "COUNTRY") return item.scopeKey === `COUNTRY:${context.country}`;
  if (item.scopeType === "TEAM") return Boolean(context.teamId && item.scopeKey === `TEAM:${context.teamId}`);
  if (item.scopeType === "USER") return item.scopeKey === `USER:${context.userId}`;
  return false;
}
