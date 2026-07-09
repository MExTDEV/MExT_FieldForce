import type { TranslationKey } from "@/lib/i18n";

export const managementImportExportTopics = {
  users: {
    labelKey: "importExport.topic.users",
    filename: "fieldforce-gebruikers-export.csv",
  },
  teams: {
    labelKey: "importExport.topic.teams",
    filename: "fieldforce-teams-export.csv",
  },
  kpis: {
    labelKey: "importExport.topic.kpis",
    filename: "fieldforce-kpis-export.csv",
  },
  kapstok: {
    labelKey: "importExport.topic.kapstok",
    filename: "fieldforce-kapstok-export.csv",
  },
} as const satisfies Record<
  string,
  { labelKey: TranslationKey; filename: string }
>;

export type ManagementImportExportTopic =
  keyof typeof managementImportExportTopics;

export type ManagementImportMode = "validate" | "commit";

export type ManagementImportRowResult = {
  row: number;
  key: string;
  action: "create" | "update" | "skip";
  errors: string[];
};

export type ManagementImportResult = {
  topic: ManagementImportExportTopic;
  mode: ManagementImportMode;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  rows: ManagementImportRowResult[];
};

export function isManagementImportExportTopic(
  value: string
): value is ManagementImportExportTopic {
  return value in managementImportExportTopics;
}
