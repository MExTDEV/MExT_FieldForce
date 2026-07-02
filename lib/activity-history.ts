export type ActivityHistoryKind =
  | "coaching_planned"
  | "coaching_started"
  | "coaching_completed"
  | "coaching_sent_for_approval"
  | "coaching_approved"
  | "coaching_updated"
  | "action_point_added"
  | "action_point_completed"
  | "comment_added"
  | "score_changed"
  | "pdf_exported";

export type ActivityHistoryItem = {
  id: string;
  occurredAt: string;
  kind: ActivityHistoryKind;
  typeLabel: string;
  representativeId: string;
  representativeName: string;
  teamId: string;
  teamName: string;
  status: string;
  description: string;
  performedBy: string;
  href: string;
};

export type ActivityHistoryFilterOption = {
  id: string;
  label: string;
  teamId?: string;
};

export type ActivityHistoryResponse = {
  activities: ActivityHistoryItem[];
  teams: ActivityHistoryFilterOption[];
  representatives: ActivityHistoryFilterOption[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const activityHistoryLabels: Record<ActivityHistoryKind, string> = {
  coaching_planned: "Begeleiding gepland",
  coaching_started: "Begeleiding gestart",
  coaching_completed: "Begeleiding afgewerkt",
  coaching_sent_for_approval: "Begeleiding voor akkoord verstuurd",
  coaching_approved: "Begeleiding goedgekeurd",
  coaching_updated: "Begeleiding aangepast",
  action_point_added: "Actiepunt toegevoegd",
  action_point_completed: "Actiepunt afgewerkt",
  comment_added: "Opmerking toegevoegd",
  score_changed: "Score gewijzigd",
  pdf_exported: "PDF geëxporteerd",
};
