import { randomUUID } from "node:crypto";
import { richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";
import { defaultMailDesignStyles, parseMailDesign, type MailDesignStyles } from "@/lib/mail-design";
import { type Language } from "@/lib/types";

export const transactionalMailLanguages: Language[] = ["nl", "fr", "de"];

export const transactionalMailTypes = [
  "COACHING_PLANNED",
  "COACHING_APPROVAL_REQUEST",
  "COACHING_APPROVAL_CONFIRMED",
  "COACHING_CANCELLED",
  "HELP_REQUEST_CREATED",
  "HELP_REQUEST_ANSWERED",
  "HELP_REQUEST_CLOSED",
  "HELP_REQUEST_FOLLOW_UP",
  "CONTACT_MOMENT_PLANNED",
  "CONTACT_MOMENT_UPDATED",
  "CONTACT_MOMENT_SHARED",
  "CONTACT_MOMENT_CANCELLED",
  "CONTACT_MOMENT_NOT_EXECUTED",
] as const;

export type TransactionalMailType = (typeof transactionalMailTypes)[number];
export type MailParameterValue = string | number | boolean | Date | null | undefined;
export type MailParameters = Record<string, MailParameterValue>;

type ParameterDefinition = {
  key: string;
  labelNl: string;
  descriptionNl: string;
  dataType: string;
  exampleValue?: string;
  required?: boolean;
  formatter?: string;
};

export type MailCatalogEntry = {
  key: TransactionalMailType;
  moduleCode: string;
  functionalNameNl: string;
  descriptionNl: string;
  triggerDescriptionNl: string;
  parameters: ParameterDefinition[];
  fallback: Record<Language, { subject: string; preheader: string; bodyHtml: string }>;
};

const commonParameters: ParameterDefinition[] = [
  { key: "recipient.firstName", labelNl: "Voornaam ontvanger", descriptionNl: "Voornaam van de ontvanger.", dataType: "string", exampleValue: "Sofie" },
  { key: "recipient.fullName", labelNl: "Naam ontvanger", descriptionNl: "Volledige naam van de ontvanger.", dataType: "string", exampleValue: "Sofie Peeters" },
  { key: "actor.fullName", labelNl: "Uitvoerder", descriptionNl: "Gebruiker die de actie uitvoerde.", dataType: "string", exampleValue: "Jonas Janssen" },
  { key: "entity.title", labelNl: "Titel dossier", descriptionNl: "Functionele titel van het dossier.", dataType: "string", exampleValue: "Begeleiding Sofie Peeters", required: true },
  { key: "action.url", labelNl: "Actielink", descriptionNl: "Veilige link naar het relevante FieldForce-dossier.", dataType: "url", exampleValue: "https://fieldforce.example/begeleidingen/123", required: true },
];

const coachingParameters: ParameterDefinition[] = [
  ...commonParameters,
  { key: "coaching.date", labelNl: "Datum begeleiding", descriptionNl: "Datum volgens de taal en tijdzone van de ontvanger.", dataType: "date", exampleValue: "15 september 2026" },
  { key: "coaching.startTime", labelNl: "Startuur begeleiding", descriptionNl: "Startuur volgens de tijdzone van de ontvanger.", dataType: "time", exampleValue: "09:30" },
  { key: "coaching.endTime", labelNl: "Einduur begeleiding", descriptionNl: "Einduur volgens de tijdzone van de ontvanger.", dataType: "time", exampleValue: "11:00" },
  { key: "coaching.location", labelNl: "Locatie begeleiding", descriptionNl: "Locatie of praktische plaatsaanduiding.", dataType: "string", exampleValue: "Antwerpen" },
  { key: "coaching.reason", labelNl: "Reden", descriptionNl: "Toelichting bij een annulering of statuswijziging.", dataType: "string", exampleValue: "De afspraak kan niet doorgaan." },
];

const messageParameters: ParameterDefinition[] = [
  ...commonParameters,
  { key: "action.message", labelNl: "Bericht", descriptionNl: "Gecontroleerde inhoud uit het workflowbericht.", dataType: "richText", exampleValue: "We nemen dit samen verder op." },
];

const fallbackBody = (paragraph: string, button: string) => `<p>${paragraph}</p><p><a href="{{action.url}}">${button}</a></p>`;
const messageFallbackBody = (paragraph: string, button: string) => `<p>${paragraph}</p><div>{{action.message}}</div><p><a href="{{action.url}}">${button}</a></p>`;

export const transactionalMailCatalog: MailCatalogEntry[] = [
  entry("COACHING_PLANNED", "BEGELEIDINGEN", "Begeleiding gepland", "Informeert betrokkenen over een geplande begeleiding.", "Wanneer voorafgaande notificatie actief is en de begeleiding wordt gepland.", coachingParameters, {
    nl: { subject: "Begeleiding gepland voor {{recipient.firstName}}", preheader: "Een begeleiding staat gepland.", bodyHtml: fallbackBody("Hallo {{recipient.firstName}}, er werd door {{actor.fullName}} een begeleiding ({{entity.title}}) voor jou of je team gepland op {{coaching.date}} om {{coaching.startTime}}. Bekijk de praktische informatie in FieldForce.", "Begeleiding openen") },
    fr: { subject: "Accompagnement planifié pour {{recipient.firstName}}", preheader: "Un accompagnement est planifié.", bodyHtml: fallbackBody("Bonjour {{recipient.firstName}}, {{actor.fullName}} a planifié l’accompagnement {{entity.title}} le {{coaching.date}} à {{coaching.startTime}}. Consultez les informations pratiques dans FieldForce.", "Ouvrir l’accompagnement") },
    de: { subject: "Begleitung für {{recipient.firstName}} geplant", preheader: "Eine Begleitung ist geplant.", bodyHtml: fallbackBody("Hallo {{recipient.firstName}}, {{actor.fullName}} hat die Begleitung {{entity.title}} am {{coaching.date}} um {{coaching.startTime}} geplant. Öffnen Sie die praktischen Informationen in FieldForce.", "Begleitung öffnen") },
  }),
  entry("COACHING_APPROVAL_REQUEST", "BEGELEIDINGEN", "Begeleiding ter akkoord", "Vraagt de begeleide persoon om het verslag te bekijken en akkoord te geven.", "Wanneer een begeleiding ter akkoord wordt verstuurd of herinnerd.", coachingParameters, {
    nl: { subject: "Begeleiding klaar voor jouw akkoord", preheader: "Vul eerst de reflectievragen in.", bodyHtml: fallbackBody("Hallo {{recipient.firstName}}, de begeleiding {{entity.title}} staat klaar voor jouw beoordeling. Vul eerst de drie verplichte reflectievragen in en geef daarna je akkoord in FieldForce.", "Akkoord openen") },
    fr: { subject: "Accompagnement prêt pour votre validation", preheader: "Complétez d’abord les questions de réflexion.", bodyHtml: fallbackBody("Bonjour {{recipient.firstName}}, l’accompagnement {{entity.title}} est prêt pour votre évaluation. Complétez d’abord les trois questions de réflexion obligatoires, puis donnez votre validation dans FieldForce.", "Ouvrir la validation") },
    de: { subject: "Begleitung zur Bestätigung bereit", preheader: "Füllen Sie zuerst die Reflexionsfragen aus.", bodyHtml: fallbackBody("Hallo {{recipient.firstName}}, die Begleitung {{entity.title}} ist zur Beurteilung bereit. Füllen Sie zuerst die drei verpflichtenden Reflexionsfragen aus und bestätigen Sie danach in FieldForce.", "Bestätigung öffnen") },
  }),
  entry("COACHING_APPROVAL_CONFIRMED", "BEGELEIDINGEN", "Begeleiding akkoord bevestigd", "Informeert de verantwoordelijke coach of indiener over het bevestigde akkoord.", "Wanneer de begeleide persoon een akkoord bevestigt.", commonParameters, {
    nl: { subject: "Akkoord bevestigd: {{entity.title}}", preheader: "De begeleiding werd bevestigd.", bodyHtml: fallbackBody("De begeleide gebruiker heeft de begeleiding {{entity.title}} bevestigd. Controleer indien nodig het dossier in FieldForce.", "Dossier openen") },
    fr: { subject: "Validation confirmée : {{entity.title}}", preheader: "L’accompagnement a été confirmé.", bodyHtml: fallbackBody("La personne accompagnée a confirmé l’accompagnement {{entity.title}}. Consultez le dossier dans FieldForce si nécessaire.", "Ouvrir le dossier") },
    de: { subject: "Bestätigung erhalten: {{entity.title}}", preheader: "Die Begleitung wurde bestätigt.", bodyHtml: fallbackBody("Die begleitete Person hat die Begleitung {{entity.title}} bestätigt. Öffnen Sie den Vorgang bei Bedarf in FieldForce.", "Vorgang öffnen") },
  }),
  entry("COACHING_CANCELLED", "BEGELEIDINGEN", "Begeleiding geannuleerd", "Informeert oorspronkelijke betrokkenen over een annulering.", "Wanneer een toekomstige geplande begeleiding wordt geannuleerd.", coachingParameters, {
    nl: { subject: "Begeleiding geannuleerd: {{entity.title}}", preheader: "Een geplande begeleiding gaat niet door.", bodyHtml: fallbackBody("De begeleiding {{entity.title}} gaat niet door. Reden: {{coaching.reason}}. Bekijk het dossier voor de actuele informatie.", "Dossier openen") },
    fr: { subject: "Accompagnement annulé : {{entity.title}}", preheader: "Un accompagnement planifié est annulé.", bodyHtml: fallbackBody("L’accompagnement {{entity.title}} est annulé. Motif : {{coaching.reason}}. Consultez le dossier pour les informations actuelles.", "Ouvrir le dossier") },
    de: { subject: "Begleitung abgesagt: {{entity.title}}", preheader: "Eine geplante Begleitung findet nicht statt.", bodyHtml: fallbackBody("Die Begleitung {{entity.title}} wurde abgesagt. Grund: {{coaching.reason}}. Öffnen Sie den Vorgang für aktuelle Informationen.", "Vorgang öffnen") },
  }),
  entry("HELP_REQUEST_CREATED", "HULPAANVRAGEN", "Nieuwe hulpaanvraag", "Informeert de verantwoordelijke manager over een nieuwe hulpaanvraag.", "Wanneer een vertegenwoordiger een nieuwe hulpaanvraag indient.", messageParameters, {
    nl: { subject: "Nieuwe hulpaanvraag: {{entity.title}}", preheader: "Er staat een hulpaanvraag klaar voor opvolging.", bodyHtml: messageFallbackBody("Er staat een nieuwe hulpaanvraag klaar voor opvolging. Bekijk de aanvraag en noteer een concrete reactie.", "Hulpaanvraag openen") },
    fr: { subject: "Nouvelle demande d’aide : {{entity.title}}", preheader: "Une demande d’aide attend votre suivi.", bodyHtml: messageFallbackBody("Une nouvelle demande d’aide attend votre suivi. Consultez la demande et enregistrez une réponse concrète.", "Ouvrir la demande") },
    de: { subject: "Neue Hilfeanfrage: {{entity.title}}", preheader: "Eine Hilfeanfrage wartet auf Bearbeitung.", bodyHtml: messageFallbackBody("Eine neue Hilfeanfrage wartet auf Bearbeitung. Öffnen Sie die Anfrage und erfassen Sie eine konkrete Antwort.", "Hilfeanfrage öffnen") },
  }),
  entry("HELP_REQUEST_ANSWERED", "HULPAANVRAGEN", "Antwoord op hulpaanvraag", "Informeert de betrokken persoon over een antwoord.", "Wanneer een gecontroleerd antwoord aan een hulpaanvraag wordt toegevoegd.", messageParameters, {
    nl: { subject: "Antwoord op hulpaanvraag: {{entity.title}}", preheader: "Er is een antwoord toegevoegd.", bodyHtml: messageFallbackBody("Er is een antwoord toegevoegd aan je hulpaanvraag. Bekijk het antwoord en de volgende stap in FieldForce.", "Antwoord openen") },
    fr: { subject: "Réponse à la demande d’aide : {{entity.title}}", preheader: "Une réponse a été ajoutée.", bodyHtml: messageFallbackBody("Une réponse a été ajoutée à votre demande d’aide. Consultez la réponse et la prochaine étape dans FieldForce.", "Ouvrir la réponse") },
    de: { subject: "Antwort auf Hilfeanfrage: {{entity.title}}", preheader: "Eine Antwort wurde hinzugefügt.", bodyHtml: messageFallbackBody("Zu Ihrer Hilfeanfrage wurde eine Antwort hinzugefügt. Prüfen Sie die Antwort und den nächsten Schritt in FieldForce.", "Antwort öffnen") },
  }),
  entry("HELP_REQUEST_CLOSED", "HULPAANVRAGEN", "Hulpaanvraag gesloten", "Informeert over een concreet afgesloten antwoord.", "Wanneer een antwoord een hulpaanvraag afsluit.", messageParameters, {
    nl: { subject: "Hulpaanvraag gesloten: {{entity.title}}", preheader: "De hulpaanvraag werd beantwoord en gesloten.", bodyHtml: messageFallbackBody("De hulpaanvraag {{entity.title}} werd beantwoord en gesloten. Bekijk de geregistreerde uitkomst in FieldForce.", "Uitkomst openen") },
    fr: { subject: "Demande d’aide clôturée : {{entity.title}}", preheader: "La demande d’aide a été traitée et clôturée.", bodyHtml: messageFallbackBody("La demande d’aide {{entity.title}} a été traitée et clôturée. Consultez le résultat enregistré dans FieldForce.", "Ouvrir le résultat") },
    de: { subject: "Hilfeanfrage geschlossen: {{entity.title}}", preheader: "Die Hilfeanfrage wurde beantwortet und geschlossen.", bodyHtml: messageFallbackBody("Die Hilfeanfrage {{entity.title}} wurde beantwortet und geschlossen. Öffnen Sie das Ergebnis in FieldForce.", "Ergebnis öffnen") },
  }),
  entry("HELP_REQUEST_FOLLOW_UP", "HULPAANVRAGEN", "Opvolging voor hulpaanvraag", "Informeert over de gekozen concrete vervolgactie.", "Wanneer een hulpaanvraag een concrete vervolgactie krijgt.", messageParameters, {
    nl: { subject: "Opvolging voor hulpaanvraag: {{entity.title}}", preheader: "Er werd een volgende stap gekozen.", bodyHtml: messageFallbackBody("Voor de hulpaanvraag {{entity.title}} werd een concrete vervolgactie gekozen. Bekijk de details in FieldForce.", "Opvolging openen") },
    fr: { subject: "Suivi de demande d’aide : {{entity.title}}", preheader: "Une prochaine étape a été choisie.", bodyHtml: messageFallbackBody("Une action de suivi concrète a été choisie pour la demande {{entity.title}}. Consultez les détails dans FieldForce.", "Ouvrir le suivi") },
    de: { subject: "Folgeaktion für Hilfeanfrage: {{entity.title}}", preheader: "Ein nächster Schritt wurde gewählt.", bodyHtml: messageFallbackBody("Für die Hilfeanfrage {{entity.title}} wurde eine konkrete Folgeaktion gewählt. Öffnen Sie die Details in FieldForce.", "Folgeaktion öffnen") },
  }),
  entry("CONTACT_MOMENT_PLANNED", "CONTACTMOMENTEN", "Contactmoment gepland", "Informeert de betrokken vertegenwoordiger over een gepland contactmoment.", "Wanneer een zichtbaar contactmoment wordt gepland.", commonParameters, {
    nl: { subject: "Contactmoment gepland: {{entity.title}}", preheader: "Er staat een contactmoment gepland.", bodyHtml: fallbackBody("Er staat een contactmoment gepland met betrekking tot {{entity.title}}. Bekijk de afspraak en praktische informatie in FieldForce.", "Contactmoment openen") },
    fr: { subject: "Contact planifié : {{entity.title}}", preheader: "Un contact est planifié.", bodyHtml: fallbackBody("Un contact est planifié concernant {{entity.title}}. Consultez les informations pratiques dans FieldForce.", "Ouvrir le contact") },
    de: { subject: "Kontakt geplant: {{entity.title}}", preheader: "Ein Kontakt ist geplant.", bodyHtml: fallbackBody("Ein Kontakt zu {{entity.title}} ist geplant. Öffnen Sie die praktischen Informationen in FieldForce.", "Kontakt öffnen") },
  }),
  entry("CONTACT_MOMENT_UPDATED", "CONTACTMOMENTEN", "Contactmoment gewijzigd", "Informeert over een wijziging van een zichtbaar contactmoment.", "Wanneer een bestaand zichtbaar contactmoment wijzigt.", commonParameters, {
    nl: { subject: "Contactmoment gewijzigd: {{entity.title}}", preheader: "Een contactmoment werd gewijzigd.", bodyHtml: fallbackBody("Het contactmoment {{entity.title}} werd gewijzigd. Controleer de actuele gegevens in FieldForce.", "Wijziging bekijken") },
    fr: { subject: "Contact modifié : {{entity.title}}", preheader: "Un contact a été modifié.", bodyHtml: fallbackBody("Le contact {{entity.title}} a été modifié. Vérifiez les informations actuelles dans FieldForce.", "Voir la modification") },
    de: { subject: "Kontakt geändert: {{entity.title}}", preheader: "Ein Kontakt wurde geändert.", bodyHtml: fallbackBody("Der Kontakt {{entity.title}} wurde geändert. Prüfen Sie die aktuellen Angaben in FieldForce.", "Änderung ansehen") },
  }),
  entry("CONTACT_MOMENT_SHARED", "CONTACTMOMENTEN", "Contactmoment gedeeld", "Informeert dat een contactmomentverslag beschikbaar is.", "Wanneer het verslag wordt gedeeld met de betrokken persoon.", commonParameters, {
    nl: { subject: "Verslag contactmoment gedeeld: {{entity.title}}", preheader: "Het verslag staat klaar.", bodyHtml: fallbackBody("Het verslag van contactmoment {{entity.title}} is gedeeld. Bekijk het verslag en eventuele actiepunten in FieldForce.", "Verslag openen") },
    fr: { subject: "Rapport de contact partagé : {{entity.title}}", preheader: "Le rapport est disponible.", bodyHtml: fallbackBody("Le rapport du contact {{entity.title}} a été partagé. Consultez le rapport et les actions éventuelles dans FieldForce.", "Ouvrir le rapport") },
    de: { subject: "Kontaktbericht geteilt: {{entity.title}}", preheader: "Der Bericht ist verfügbar.", bodyHtml: fallbackBody("Der Bericht zum Kontakt {{entity.title}} wurde geteilt. Öffnen Sie den Bericht und mögliche Aktionen in FieldForce.", "Bericht öffnen") },
  }),
  entry("CONTACT_MOMENT_CANCELLED", "CONTACTMOMENTEN", "Contactmoment geannuleerd", "Informeert over een geannuleerd contactmoment.", "Wanneer een zichtbaar contactmoment wordt geannuleerd.", commonParameters, {
    nl: { subject: "Contactmoment geannuleerd: {{entity.title}}", preheader: "Een contactmoment gaat niet door.", bodyHtml: fallbackBody("Het contactmoment {{entity.title}} werd geannuleerd. Bekijk de actuele informatie in FieldForce.", "Dossier openen") },
    fr: { subject: "Contact annulé : {{entity.title}}", preheader: "Un contact n’aura pas lieu.", bodyHtml: fallbackBody("Le contact {{entity.title}} a été annulé. Consultez les informations actuelles dans FieldForce.", "Ouvrir le dossier") },
    de: { subject: "Kontakt abgesagt: {{entity.title}}", preheader: "Ein Kontakt findet nicht statt.", bodyHtml: fallbackBody("Der Kontakt {{entity.title}} wurde abgesagt. Öffnen Sie die aktuellen Informationen in FieldForce.", "Vorgang öffnen") },
  }),
  entry("CONTACT_MOMENT_NOT_EXECUTED", "CONTACTMOMENTEN", "Contactmoment niet uitgevoerd", "Informeert dat een contactmoment niet werd uitgevoerd.", "Wanneer een contactmoment als niet uitgevoerd wordt gemarkeerd.", commonParameters, {
    nl: { subject: "Contactmoment niet uitgevoerd: {{entity.title}}", preheader: "Een contactmoment werd niet uitgevoerd.", bodyHtml: fallbackBody("Het contactmoment {{entity.title}} werd gemarkeerd als niet uitgevoerd. Bekijk de details in FieldForce.", "Details openen") },
    fr: { subject: "Contact non exécuté : {{entity.title}}", preheader: "Un contact n’a pas été exécuté.", bodyHtml: fallbackBody("Le contact {{entity.title}} a été marqué comme non exécuté. Consultez les détails dans FieldForce.", "Ouvrir les détails") },
    de: { subject: "Kontakt nicht durchgeführt: {{entity.title}}", preheader: "Ein Kontakt wurde nicht durchgeführt.", bodyHtml: fallbackBody("Der Kontakt {{entity.title}} wurde als nicht durchgeführt markiert. Öffnen Sie die Details in FieldForce.", "Details öffnen") },
  }),
];

function entry(
  key: TransactionalMailType,
  moduleCode: string,
  functionalNameNl: string,
  descriptionNl: string,
  triggerDescriptionNl: string,
  parameters: ParameterDefinition[],
  fallback: MailCatalogEntry["fallback"]
): MailCatalogEntry {
  return { key, moduleCode, functionalNameNl, descriptionNl, triggerDescriptionNl, parameters, fallback };
}

export function getTransactionalMailCatalogEntry(type: string) {
  return transactionalMailCatalog.find((entry) => entry.key === type);
}

export function extractTemplateParameters(value: string) {
  const keys = new Set<string>();
  const pattern = /{{\s*([a-zA-Z0-9_.]+)\s*}}/g;
  for (const match of value.matchAll(pattern)) keys.add(match[1]);
  return [...keys];
}

export function validateTemplateContent(type: string, subject: string, preheader: string, bodyHtml: string) {
  const entry = getTransactionalMailCatalogEntry(type);
  if (!entry) throw new Error(`Onbekend transactioneel mailtype: ${type}.`);
  const allowed = new Set(entry.parameters.map((parameter) => parameter.key));
  const used = new Set([
    ...extractTemplateParameters(subject),
    ...extractTemplateParameters(preheader),
    ...extractTemplateParameters(bodyHtml),
  ]);
  const unknown = [...used].filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Onbekende parameters voor ${type}: ${unknown.join(", ")}.`);
  const required = entry.parameters.filter((parameter) => parameter.required).map((parameter) => parameter.key);
  const missing = required.filter((key) => !used.has(key));
  if (missing.length) throw new Error(`Verplichte parameters ontbreken voor ${type}: ${missing.join(", ")}.`);
  if (/javascript:|vbscript:|data:text\/html|on[a-z]+\s*=/i.test(bodyHtml)) {
    throw new Error("De template bevat een onveilige HTML- of URL-constructie.");
  }
  return [...used];
}

export function renderTransactionalTemplate(input: {
  type: string;
  language: Language;
  subject: string;
  preheader?: string | null;
  bodyHtml: string;
  parameters: MailParameters;
  headerHtml?: string;
  footerHtml?: string;
  senderName?: string;
  logoUrl?: string;
}) {
  const entry = getTransactionalMailCatalogEntry(input.type);
  if (!entry) throw new Error(`Onbekend transactioneel mailtype: ${input.type}.`);
  const parameterMap = new Map(entry.parameters.map((parameter) => [parameter.key, parameter]));
  const render = (value: string, html = false) => value.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_match, key: string) => {
    const definition = parameterMap.get(key);
    const raw = input.parameters[key];
    if (raw === undefined || raw === null || raw === "") return "";
    if (html && definition?.dataType === "richText") return sanitizeRichText(String(raw));
    return escapeHtml(formatParameter(raw, definition?.dataType, input.language));
  });
  const subject = render(input.subject);
  const preheader = render(input.preheader ?? "");
  const design = parseMailDesign(input.bodyHtml);
  const body = sanitizeRichText(render(design?.bodyHtml ?? input.bodyHtml, true));
  const header = sanitizeRichText(render(design?.headerHtml ?? input.headerHtml ?? "", true));
  const footer = sanitizeRichText(render(design?.footerHtml ?? input.footerHtml ?? defaultFooter(input.language), true));
  const title = subject;
  const html = uniformMailLayout({ language: input.language, senderName: input.senderName ?? "MExT FieldForce", logoUrl: input.logoUrl, preheader, title, header, body, footer, styles: design?.styles ?? defaultMailDesignStyles });
  const text = [preheader, richTextToPlainText(header), richTextToPlainText(body), richTextToPlainText(footer)].filter(Boolean).join("\n\n");
  if (/{{\s*[a-zA-Z0-9_.]+\s*}}/.test(subject) || /{{\s*[a-zA-Z0-9_.]+\s*}}/.test(body)) {
    throw new Error("De gerenderde mail bevat een oningevulde parameter.");
  }
  return { subject, preheader, text, html };
}

export function defaultTransactionalMail(input: { type: TransactionalMailType; language: Language; parameters: MailParameters; senderName?: string }) {
  const entry = getTransactionalMailCatalogEntry(input.type);
  if (!entry) throw new Error(`Onbekend transactioneel mailtype: ${input.type}.`);
  const fallback = entry.fallback[input.language] ?? entry.fallback.nl;
  validateTemplateContent(input.type, fallback.subject, fallback.preheader, fallback.bodyHtml);
  return renderTransactionalTemplate({ ...input, ...fallback });
}

export function newMailCorrelationId() {
  return randomUUID();
}

function formatParameter(value: MailParameterValue, dataType?: string, language: Language = "nl") {
  if (value instanceof Date) {
    const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-BE" : "nl-BE";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Brussels" }).format(value);
  }
  if (dataType === "url") {
    const text = String(value);
    if (/^(https?:\/\/|\/)/i.test(text)) return text;
    return "";
  }
  return String(value);
}

function uniformMailLayout(input: { language: Language; senderName: string; logoUrl?: string; preheader: string; title: string; header: string; body: string; footer: string; styles: MailDesignStyles }) {
  const logo = input.logoUrl && /^(https?:\/\/|\/)/i.test(input.logoUrl) ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.senderName)}" style="max-height:42px;max-width:180px;display:block;margin-bottom:10px;" />` : "";
  const headerContent = input.header || `${logo}${escapeHtml(input.senderName)}`;
  return `<!doctype html><html lang="${input.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>.fieldforce-mail a{color:${input.styles.linkColor};}</style></head><body style="margin:0;background:${input.styles.backgroundColor};font-family:Arial,Helvetica,sans-serif;color:${input.styles.bodyTextColor};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${input.styles.backgroundColor};"><tr><td align="center" style="padding:24px 12px;"><table class="fieldforce-mail" role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${input.styles.cardColor};overflow:hidden;"><tr><td style="background:${input.styles.headerColor};padding:22px 28px;color:${input.styles.headerTextColor};font-size:20px;font-weight:700;">${headerContent}</td></tr><tr><td style="padding:28px;color:${input.styles.bodyTextColor};"><h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${input.styles.bodyTextColor};">${input.title}</h1><div style="font-size:16px;line-height:1.6;color:${input.styles.bodyTextColor};">${input.body}</div></td></tr><tr><td style="border-top:1px solid ${input.styles.backgroundColor};padding:20px 28px;background:${input.styles.footerColor};color:${input.styles.footerTextColor};font-size:13px;line-height:1.5;">${input.footer}</td></tr></table></td></tr></table></body></html>`;
}

function defaultFooter(language: Language) {
  if (language === "fr") return "<p>Vous recevez cet e-mail de FieldForce. Pour toute question, contactez votre équipe.</p>";
  if (language === "de") return "<p>Sie erhalten diese E-Mail von FieldForce. Bei Fragen wenden Sie sich an Ihr Team.</p>";
  return "<p>Je ontvangt deze e-mail van FieldForce. Neem bij vragen contact op met je team.</p>";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
