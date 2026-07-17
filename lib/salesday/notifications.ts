import type { SalesDayNotificationType } from "@/lib/salesday/runtime-configuration";
import type { Language } from "@/lib/types";

type NeutralNotification = { title: string; body: string };

const neutralNotifications: Record<Language, Record<SalesDayNotificationType, NeutralNotification>> = {
  nl: {
    APPOINTMENT_CHANGED: { title: "SalesDay bijgewerkt", body: "Er is een wijziging voor je werkdag. Open de app voor de details." },
    PREPARATION_AVAILABLE: { title: "Voorbereiding beschikbaar", body: "Je volgende voorbereiding staat klaar in SalesDay." },
    SYNC_FAILED: { title: "Synchronisatie vereist", body: "SalesDay vraagt je aandacht. Open de app om opnieuw te synchroniseren." },
    CASH_BLOCKED: { title: "Actie vereist in SalesDay", body: "Je werkdag kan nog niet worden geopend. Bekijk de details in de app." },
    DOCUMENT_STATUS: { title: "Documentstatus bijgewerkt", body: "Er is een nieuwe documentstatus. Open SalesDay voor de details." },
  },
  fr: {
    APPOINTMENT_CHANGED: { title: "SalesDay mis à jour", body: "Votre journée de travail a été modifiée. Ouvrez l’application pour les détails." },
    PREPARATION_AVAILABLE: { title: "Préparation disponible", body: "Votre prochaine préparation est disponible dans SalesDay." },
    SYNC_FAILED: { title: "Synchronisation requise", body: "SalesDay demande votre attention. Ouvrez l’application pour resynchroniser." },
    CASH_BLOCKED: { title: "Action requise dans SalesDay", body: "Votre journée ne peut pas encore être ouverte. Consultez l’application." },
    DOCUMENT_STATUS: { title: "Statut du document mis à jour", body: "Un statut de document a changé. Ouvrez SalesDay pour les détails." },
  },
  de: {
    APPOINTMENT_CHANGED: { title: "SalesDay aktualisiert", body: "Ihr Arbeitstag wurde geändert. Öffnen Sie die App für Einzelheiten." },
    PREPARATION_AVAILABLE: { title: "Vorbereitung verfügbar", body: "Ihre nächste Vorbereitung ist in SalesDay verfügbar." },
    SYNC_FAILED: { title: "Synchronisierung erforderlich", body: "SalesDay benötigt Ihre Aufmerksamkeit. Öffnen Sie die App und synchronisieren Sie erneut." },
    CASH_BLOCKED: { title: "Aktion in SalesDay erforderlich", body: "Ihr Arbeitstag kann noch nicht geöffnet werden. Details finden Sie in der App." },
    DOCUMENT_STATUS: { title: "Dokumentstatus aktualisiert", body: "Ein Dokumentstatus wurde geändert. Details finden Sie in SalesDay." },
  },
};

export function buildNeutralSalesDayLockScreenNotification(
  type: SalesDayNotificationType,
  language: Language,
): NeutralNotification {
  return { ...neutralNotifications[language][type] };
}
