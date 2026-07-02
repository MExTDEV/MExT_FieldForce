import type { jsPDF } from "jspdf";
import type {
  CoachingAppointment,
  CoachingIntervention,
  CoachingSimpleScore,
  Language,
  Representative,
} from "@/lib/types";

export type ProfessionalCoachingReportInput = {
  intervention: CoachingIntervention;
  previousIntervention?: CoachingIntervention;
  representative: Representative;
  leaderName: string;
  language: Language;
  logoDataUrl?: string;
};

export type ProfessionalCoachingReportResult = {
  arrayBuffer: ArrayBuffer;
  filename: string;
  pageCount: number;
};

type Pdf = jsPDF;
type ScoreRow = {
  group: string;
  criterion: string;
  current: number;
  previous?: number;
  comment?: string;
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_TOP = 30;
const CONTENT_BOTTOM = 276;
const BLUE = "#003B83";
const LIGHT_BLUE = "#EAF3FD";
const MID_BLUE = "#1683C4";
const SLATE_950 = "#0F172A";
const SLATE_700 = "#334155";
const SLATE_500 = "#64748B";
const SLATE_300 = "#CBD5E1";
const SLATE_100 = "#F1F5F9";
const GREEN = "#15803D";
const RED = "#B91C1C";
const AMBER = "#B45309";

const translations = {
  nl: {
    report: "Begeleidingsrapport",
    contents: "Inhoud",
    general: "Algemene gegevens",
    preparation: "Voorbereiding",
    performance: "Prestatiecirkel",
    scoreAnalysis: "Score-analyse",
    actionPoints: "Actiepunten",
    conclusion: "Eindbesluit",
    appointment: "Afspraak",
    representative: "Vertegenwoordiger",
    team: "Team",
    leader: "Verkoopleider",
    date: "Datum begeleiding",
    country: "Land",
    status: "Status",
    start: "Startuur",
    end: "Einduur",
    duration: "Duur",
    area: "Regio",
    sector: "Sector",
    kilometers: "Kilometers",
    customer: "Klant",
    customerNumber: "Klantnummer",
    place: "Plaats",
    customerType: "Type klant",
    appointmentType: "Type afspraak",
    activity: "Activiteit",
    remarks: "Vrije notities",
    scores: "Scores en beoordelingen",
    criterion: "Criterium",
    previous: "Vorige",
    current: "Nieuwe",
    difference: "Verschil",
    improved: "Verbeterd",
    unchanged: "Ongewijzigd",
    declined: "Verslechterd",
    firstMeasurement: "Eerste meting",
    average: "Gemiddelde score",
    criteria: "Aantal criteria",
    highest: "Hoogste score",
    lowest: "Laagste score",
    priority: "Prioriteit",
    owner: "Eigenaar",
    deadline: "Deadline",
    summary: "Samenvatting",
    strongest: "Sterkste punten",
    improvements: "Belangrijkste verbeterpunten",
    nextCoaching: "Volgende begeleiding",
    nextActions: "Volgende actiepunten",
    page: "Pagina",
    of: "van",
    ofAppointments: "van",
    groupAttention: "Groepsaandachtspunt",
    individualAttention: "Individueel aandachtspunt",
    generalEvaluation: "Evaluatie algemene punten",
    personality: "Persoonlijkheid",
    kpiSnapshot: "KPI-overzicht",
    noScore: "Niet beoordeeld",
    generated: "Professioneel rapport gegenereerd door MExT FieldForce",
    continued: "vervolg",
    managementSummary: "Managementsamenvatting",
    coachAdvice: "Coachingsadvies",
    distribution: "Scoreverdeling",
    categoryEvolution: "Evolutie per categorie",
    coachingPriorities: "Coachingsprioriteiten",
    openActions: "Open actiepunten",
    approval: "Digitale goedkeuring",
  },
  fr: {
    report: "Rapport d'accompagnement",
    contents: "Sommaire",
    general: "Données générales",
    preparation: "Préparation",
    performance: "Cercle de performance",
    scoreAnalysis: "Analyse des scores",
    actionPoints: "Points d'action",
    conclusion: "Conclusion",
    appointment: "Rendez-vous",
    representative: "Représentant",
    team: "Équipe",
    leader: "Responsable commercial",
    date: "Date de l'accompagnement",
    country: "Pays",
    status: "Statut",
    start: "Heure de début",
    end: "Heure de fin",
    duration: "Durée",
    area: "Région",
    sector: "Secteur",
    kilometers: "Kilomètres",
    customer: "Client",
    customerNumber: "Numéro client",
    place: "Lieu",
    customerType: "Type de client",
    appointmentType: "Type de rendez-vous",
    activity: "Activité",
    remarks: "Notes libres",
    scores: "Scores et évaluations",
    criterion: "Critère",
    previous: "Précédent",
    current: "Nouveau",
    difference: "Différence",
    improved: "Amélioré",
    unchanged: "Inchangé",
    declined: "En baisse",
    firstMeasurement: "Première mesure",
    average: "Score moyen",
    criteria: "Nombre de critères",
    highest: "Score le plus élevé",
    lowest: "Score le plus bas",
    priority: "Priorité",
    owner: "Responsable",
    deadline: "Échéance",
    summary: "Résumé",
    strongest: "Points forts",
    improvements: "Principaux points d'amélioration",
    nextCoaching: "Prochain accompagnement",
    nextActions: "Prochaines actions",
    page: "Page",
    of: "sur",
    ofAppointments: "sur",
    groupAttention: "Point d'attention collectif",
    individualAttention: "Point d'attention individuel",
    generalEvaluation: "Évaluation générale",
    personality: "Personnalité",
    kpiSnapshot: "Aperçu KPI",
    noScore: "Non évalué",
    generated: "Rapport professionnel généré par MExT FieldForce",
    continued: "suite",
    managementSummary: "Résumé de gestion",
    coachAdvice: "Conseil de coaching",
    distribution: "Répartition des scores",
    categoryEvolution: "Évolution par catégorie",
    coachingPriorities: "Priorités de coaching",
    openActions: "Actions ouvertes",
    approval: "Approbation numérique",
  },
  de: {
    report: "Begleitungsbericht",
    contents: "Inhalt",
    general: "Allgemeine Daten",
    preparation: "Vorbereitung",
    performance: "Leistungskreis",
    scoreAnalysis: "Score-Analyse",
    actionPoints: "Aktionspunkte",
    conclusion: "Abschluss",
    appointment: "Termin",
    representative: "Vertreter",
    team: "Team",
    leader: "Verkaufsleiter",
    date: "Begleitungsdatum",
    country: "Land",
    status: "Status",
    start: "Startzeit",
    end: "Endzeit",
    duration: "Dauer",
    area: "Region",
    sector: "Sektor",
    kilometers: "Kilometer",
    customer: "Kunde",
    customerNumber: "Kundennummer",
    place: "Ort",
    customerType: "Kundentyp",
    appointmentType: "Termintyp",
    activity: "Aktivität",
    remarks: "Freie Notizen",
    scores: "Scores und Bewertungen",
    criterion: "Kriterium",
    previous: "Vorher",
    current: "Neu",
    difference: "Differenz",
    improved: "Verbessert",
    unchanged: "Unverändert",
    declined: "Verschlechtert",
    firstMeasurement: "Erste Messung",
    average: "Durchschnittsscore",
    criteria: "Anzahl Kriterien",
    highest: "Höchster Score",
    lowest: "Niedrigster Score",
    priority: "Priorität",
    owner: "Verantwortlich",
    deadline: "Frist",
    summary: "Zusammenfassung",
    strongest: "Stärkste Punkte",
    improvements: "Wichtigste Verbesserungen",
    nextCoaching: "Nächste Begleitung",
    nextActions: "Nächste Aktionen",
    page: "Seite",
    of: "von",
    ofAppointments: "von",
    groupAttention: "Gruppenfokus",
    individualAttention: "Individueller Fokus",
    generalEvaluation: "Allgemeine Bewertung",
    personality: "Persönlichkeit",
    kpiSnapshot: "KPI-Übersicht",
    noScore: "Nicht bewertet",
    generated: "Professioneller Bericht von MExT FieldForce",
    continued: "Fortsetzung",
    managementSummary: "Management-Zusammenfassung",
    coachAdvice: "Coaching-Empfehlung",
    distribution: "Scoreverteilung",
    categoryEvolution: "Entwicklung je Kategorie",
    coachingPriorities: "Coaching-Prioritäten",
    openActions: "Offene Maßnahmen",
    approval: "Digitale Freigabe",
  },
} as const;

export async function exportProfessionalCoachingReport(
  input: ProfessionalCoachingReportInput,
  options: { download?: boolean } = {}
): Promise<ProfessionalCoachingReportResult> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = input.logoDataUrl ?? await loadLogoDataUrl();
  const appointments = (input.intervention.appointments ?? []).filter((item) => !item.isDeleted);

  paintWhiteBackground(pdf);
  drawCover(pdf, input, logo);

  startSection(pdf);
  drawGeneralPage(pdf, input);

  const scoreRows = collectScoreRows(input.intervention);
  const previousRows = new Map(
    collectScoreRows(input.previousIntervention).map((row) => [`${row.group}::${row.criterion}`, row.current])
  );
  const comparedRows = scoreRows.map((row) => ({
    ...row,
    previous: previousRows.get(`${row.group}::${row.criterion}`) ?? row.previous,
  }));

  startSection(pdf);
  drawPerformancePage(pdf, input, comparedRows);

  startSection(pdf);
  drawScoreAnalysis(pdf, input, comparedRows);

  appointments.forEach((appointment, index) => {
    startSection(pdf);
    drawAppointment(pdf, input, appointment, index, appointments.length);
  });

  startSection(pdf);
  drawConclusion(pdf, input, comparedRows);

  drawHeadersAndFooters(pdf, input, logo);

  const filename = `Begeleiding_${slugify(`${input.representative.firstName}_${input.representative.lastName}`)}_${input.intervention.plannedDate ?? input.intervention.createdAt.slice(0, 10)}.pdf`;
  const arrayBuffer = pdf.output("arraybuffer");
  if (options.download !== false) pdf.save(filename);
  return { arrayBuffer, filename, pageCount: pdf.getNumberOfPages() };
}

function startSection(pdf: Pdf) {
  addWhitePage(pdf);
}

function drawCover(pdf: Pdf, input: ProfessionalCoachingReportInput, logo?: string) {
  const t = translations[input.language];
  const rows = collectScoreRows(input.intervention);
  const previousRows = collectScoreRows(input.previousIntervention);
  const score = rows.length ? averageOf(rows.map((row) => row.current)) : 0;
  const previousScore = previousRows.length ? averageOf(previousRows.map((row) => row.current)) : undefined;
  pdf.setFillColor(BLUE);
  pdf.rect(0, 0, PAGE_WIDTH, 72, "F");
  pdf.setFillColor(MID_BLUE);
  pdf.circle(193, -3, 47, "F");
  if (logo) {
    pdf.setFillColor("#FFFFFF");
    pdf.roundedRect(MARGIN, 12, 52, 20, 3, 3, "F");
    pdf.addImage(logo, "PNG", MARGIN + 5, 16, 40, 12, undefined, "FAST");
  } else drawWordmark(pdf, MARGIN, 22);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor("#FFFFFF");
  pdf.text(t.report, MARGIN, 47);
  pdf.setFontSize(10);
  pdf.text("Grow. Coach. Perform.", MARGIN, 59);

  pdf.setFontSize(21);
  pdf.setTextColor(SLATE_950);
  pdf.text(fullName(input.representative), MARGIN, 93);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(SLATE_500);
  pdf.text(`${input.representative.team}  |  ${input.leaderName}`, MARGIN, 102);

  const coverMeta = [
    [t.date, formatDate(input.intervention.plannedDate ?? input.intervention.createdAt, input.language)],
    [t.status, localizedValue(input.intervention.status, input.language)],
    [t.country, input.intervention.country],
  ];
  drawInfoGrid(pdf, coverMeta, 111, 3, 28);

  pdf.setFillColor(LIGHT_BLUE);
  pdf.circle(43, 165, 22, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(BLUE);
  pdf.text(rows.length ? scoreLabel(score) : "-", 43, 168, { align: "center" });
  pdf.setFontSize(6.5);
  pdf.text(t.average.toUpperCase(), 43, 176, { align: "center" });

  const summary = [
    [t.duration, durationLabel(input.intervention.startTime, input.intervention.endTime) || "-"],
    [t.appointment, String((input.intervention.appointments ?? []).filter((item) => !item.isDeleted).length)],
    [t.actionPoints, String(input.intervention.actionPoints.length)],
    [t.average, rows.length ? scoreLabel(score) : "-"],
    [t.difference, previousScore === undefined ? t.firstMeasurement : signedScore(score - previousScore)],
  ];
  drawCompactKeyValueList(pdf, t.summary, summary, 75, 143, 119, 47, 5);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(SLATE_500);
  pdf.text(t.generated, MARGIN, 220);
}

function drawGeneralPage(pdf: Pdf, input: ProfessionalCoachingReportInput) {
  const t = translations[input.language];
  drawSectionHeading(pdf, t.managementSummary, fullName(input.representative));
  const dossier = input.intervention.dossier;
  const leftValues = [
    [t.representative, fullName(input.representative)],
    [t.leader, input.leaderName],
    [t.team, input.representative.team],
    [t.area, dossier?.area ?? ""],
    [t.country, input.intervention.country],
    [t.date, formatDate(input.intervention.plannedDate ?? input.intervention.createdAt, input.language)],
    [t.start, input.intervention.startTime ?? dossier?.arrivalTime ?? ""],
    [t.end, input.intervention.endTime ?? dossier?.departureTime ?? ""],
    [t.duration, durationLabel(input.intervention.startTime, input.intervention.endTime)],
    [t.kilometers, dossier?.kilometers ?? ""],
    [t.status, localizedValue(input.intervention.status, input.language)],
  ].filter(([, value]) => value);
  const rightValues = [
    ...(dossier?.groupAttentionPoints ?? []).filter(Boolean).map((value, index) => [`${t.groupAttention} ${index + 1}`, value]),
    ...(dossier?.individualAttentionPoint ? [[t.individualAttention, dossier.individualAttentionPoint]] : []),
    ...input.representative.kpis.slice(0, 3).map((kpi) => [kpi.label, `${kpi.value} / ${kpi.target}`]),
  ];
  drawCompactKeyValueList(pdf, t.general, leftValues, MARGIN, 49, 86, 148);
  drawCompactKeyValueList(pdf, t.preparation, rightValues.length ? rightValues : [[t.summary, "-"]], 108, 49, 86, 148);

  const rows = collectScoreRows(input.intervention);
  const sorted = [...rows].sort((left, right) => right.current - left.current);
  const openActions = input.intervention.actionPoints.filter((action) => !["afgerond", "behaald", "geannuleerd"].includes(action.status));
  const cardY = 205;
  const cardWidth = (CONTENT_WIDTH - 8) / 3;
  drawInsightCard(pdf, t.strongest, sorted.slice(0, 3).map((row) => row.criterion), MARGIN, cardY, cardWidth, GREEN);
  drawInsightCard(pdf, t.improvements, sorted.slice(-3).reverse().map((row) => row.criterion), MARGIN + cardWidth + 4, cardY, cardWidth, RED);
  drawInsightCard(pdf, t.openActions, [`${openActions.length}`, ...openActions.slice(0, 2).map((action) => action.due ? formatDate(action.due, input.language) : action.title)], MARGIN + (cardWidth + 4) * 2, cardY, cardWidth, AMBER);
}

function drawPerformancePage(pdf: Pdf, input: ProfessionalCoachingReportInput, rows: ScoreRow[]) {
  const t = translations[input.language];
  drawSectionHeading(pdf, "Prestatieoverzicht", fullName(input.representative));
  const scores = rows.map((row) => row.current);
  const average = scores.length ? averageOf(scores) : 0;
  const previous = rows.flatMap((row) => row.previous === undefined ? [] : [row.previous]);
  drawPerformanceWheel(pdf, rows, 59, 112, 39);
  const summary = [
    [t.current, scoreLabel(average)],
    [t.previous, previous.length ? scoreLabel(averageOf(previous)) : t.firstMeasurement],
    [t.difference, previous.length ? signedScore(average - averageOf(previous)) : "-"],
    [t.highest, rows.length ? scoreLabel(Math.max(...scores)) : "-"],
    [t.lowest, rows.length ? scoreLabel(Math.min(...scores)) : "-"],
    [t.criteria, String(rows.length)],
  ];
  drawCompactKeyValueList(pdf, t.summary, summary, 108, 50, 86, 79, 2);

  const sorted = [...rows].sort((left, right) => right.current - left.current);
  drawInsightCard(pdf, t.strongest, sorted.slice(0, 3).map((row) => `${row.criterion} (${scoreLabel(row.current)})`), MARGIN, 163, 86, GREEN);
  drawInsightCard(pdf, t.improvements, sorted.slice(-3).reverse().map((row) => `${row.criterion} (${scoreLabel(row.current)})`), 108, 163, 86, RED);

  const distribution = [5, 4, 3, 2, 1].map((value) => `${value}/5: ${rows.filter((row) => Math.max(1, Math.round(row.current / 20)) === value).length}`);
  const categoryEvolution = categoryEvolutionLines(rows);
  drawInsightCard(pdf, t.distribution, distribution, MARGIN, 218, 56, BLUE);
  drawInsightCard(pdf, t.categoryEvolution, categoryEvolution.slice(0, 5), 76, 218, 75, MID_BLUE);
  drawInsightCard(pdf, t.coachingPriorities, sorted.slice(-3).reverse().map((row, index) => `${index + 1}. ${row.criterion}`), 155, 218, 39, AMBER);
}

function drawScoreAnalysis(pdf: Pdf, input: ProfessionalCoachingReportInput, rows: ScoreRow[]) {
  const t = translations[input.language];
  drawSectionHeading(pdf, t.scoreAnalysis, fullName(input.representative));
  let y = 47;
  const headers = [t.summary, t.criterion, t.previous, t.current, t.difference];
  const widths = [35, 69, 20, 20, 34];
  y = drawTableHeader(pdf, headers, widths, y);
  for (const row of rows) {
    const difference = row.previous === undefined ? undefined : row.current - row.previous;
    const rowHeight = 8.5;
    if (y + rowHeight > CONTENT_BOTTOM) {
      addWhitePage(pdf);
      drawSectionHeading(pdf, `${t.scoreAnalysis} - ${t.continued}`, fullName(input.representative));
      y = drawTableHeader(pdf, headers, widths, 47);
    }
    const trend = difference === undefined ? t.firstMeasurement : difference > 0 ? t.improved : difference < 0 ? t.declined : t.unchanged;
    drawScoreRow(pdf, row, trend, difference, y, rowHeight);
    y += rowHeight;
  }
  y += 5;
  y = drawCoachingRemarks(pdf, input, rows, y);
  if (input.intervention.actionPoints.length) {
    y += 5;
    drawActionPointsTable(pdf, input, y);
  }
}

function drawAppointment(
  pdf: Pdf,
  input: ProfessionalCoachingReportInput,
  appointment: CoachingAppointment,
  index: number,
  total: number
) {
  const t = translations[input.language];
  drawSectionHeading(
    pdf,
    `${t.appointment} ${index + 1} ${t.ofAppointments} ${total}`,
    appointment.customer || t.appointment
  );
  const meta = [
    [t.customer, appointment.customer],
    [t.customerNumber, appointment.customerNumber ?? ""],
    [t.place, appointment.place ?? ""],
    [t.customerType, localizedValue(appointment.relationType, input.language)],
    [t.appointmentType, localizedValue(appointment.appointmentType, input.language)],
    [t.start, appointment.arrivalTime],
    [t.end, appointment.departureTime],
    [t.duration, durationLabel(appointment.arrivalTime, appointment.departureTime)],
  ].filter(([, value]) => value);
  let y = drawCompactKeyValueList(pdf, t.general, meta, MARGIN, 47, CONTENT_WIDTH, 34, 4);
  const narratives = [
    ...(appointment.activity ? [[t.activity, appointment.activity]] : []),
    ...(appointment.remarks ? [[t.remarks, appointment.remarks]] : []),
  ];
  if (narratives.length) {
    y += 5;
    y = drawPairedTextCards(pdf, narratives, y);
  }
  if (appointment.scores.length) {
    y += 5;
    y = drawAppointmentScores(pdf, input, appointment.scores, y, `${t.appointment} ${index + 1}`);
  }

  const scored = appointment.scores.filter((score) => score.score !== "nvt");
  const ranked = [...scored].sort((left, right) => Number(right.score) - Number(left.score));
  const comments = appointment.scores.filter((score) => score.comment?.trim());
  if (y + 38 > CONTENT_BOTTOM) {
    addWhitePage(pdf);
    drawSectionHeading(pdf, `${t.appointment} ${index + 1} - ${t.summary}`, fullName(input.representative));
    y = 49;
  } else {
    y += 6;
  }
  const width = (CONTENT_WIDTH - 8) / 3;
  drawInsightCard(
    pdf,
    t.strongest,
    ranked.slice(0, 3).map((score) => `${score.criterion} (${score.score}/5)`),
    MARGIN,
    y,
    width,
    GREEN,
    32
  );
  drawInsightCard(
    pdf,
    t.improvements,
    ranked.slice(-3).reverse().map((score) => `${score.criterion} (${score.score}/5)`),
    MARGIN + width + 4,
    y,
    width,
    RED,
    32
  );
  drawInsightCard(
    pdf,
    t.coachAdvice,
    comments.slice(0, 3).map((score) => score.comment),
    MARGIN + (width + 4) * 2,
    y,
    width,
    AMBER,
    32
  );
}

function drawConclusion(pdf: Pdf, input: ProfessionalCoachingReportInput, rows: ScoreRow[]) {
  const t = translations[input.language];
  drawSectionHeading(pdf, t.conclusion, fullName(input.representative));
  const sorted = [...rows].sort((left, right) => right.current - left.current);
  const actions = input.intervention.actionPoints.filter((action) => !["afgerond", "behaald", "geannuleerd"].includes(action.status));
  const average = rows.length ? averageOf(rows.map((row) => row.current)) : undefined;
  drawCompactKeyValueList(pdf, t.summary, [
    [t.average, average === undefined ? "-" : scoreLabel(average)],
    [t.status, localizedValue(input.intervention.status, input.language)],
    [t.criteria, String(rows.length)],
    [t.appointment, String((input.intervention.appointments ?? []).filter((item) => !item.isDeleted).length)],
    [t.openActions, String(actions.length)],
    [t.date, formatDate(input.intervention.plannedDate ?? input.intervention.createdAt, input.language)],
  ], MARGIN, 49, CONTENT_WIDTH, 42, 3);

  const cardWidth = (CONTENT_WIDTH - 8) / 3;
  drawInsightCard(pdf, t.strongest, sorted.slice(0, 3).map((row) => `${row.criterion} (${scoreLabel(row.current)})`), MARGIN, 98, cardWidth, GREEN);
  drawInsightCard(pdf, t.improvements, sorted.slice(-3).reverse().map((row) => `${row.criterion} (${scoreLabel(row.current)})`), MARGIN + cardWidth + 4, 98, cardWidth, RED);
  drawInsightCard(pdf, t.coachingPriorities, sorted.slice(-3).reverse().map((row, index) => `${index + 1}. ${row.criterion}`), MARGIN + (cardWidth + 4) * 2, 98, cardWidth, AMBER);

  drawInsightCard(pdf, t.openActions, actions.slice(0, 5).map((action) => `${action.title}${action.due ? ` - ${formatDate(action.due, input.language)}` : ""}`), MARGIN, 153, 117, MID_BLUE);
  drawInsightCard(pdf, t.nextCoaching, [input.intervention.dossier?.individualAttentionPoint || sorted.at(-1)?.criterion || "-"], 137, 153, 57, AMBER);

  const note = input.intervention.internalNotes?.trim()
    || rows.find((row) => row.comment?.trim())?.comment
    || (input.intervention.dossier?.individualAttentionPoint ?? "-");
  drawCompactKeyValueList(pdf, t.remarks, [[t.summary, note]], MARGIN, 208, CONTENT_WIDTH, 28);

  const approvalValues = [
    [t.leader, `${input.leaderName} - ${formatDateTime(input.intervention.finalizedAt ?? input.intervention.updatedAt, input.language)}`],
    ...(input.intervention.sentForApprovalAt ? [["Voor akkoord verzonden", formatDateTime(input.intervention.sentForApprovalAt, input.language)]] : []),
    ...(input.intervention.approvedByRepAt ? [[t.representative, `${fullName(input.representative)} - ${formatDateTime(input.intervention.approvedByRepAt, input.language)}`]] : []),
  ];
  drawCompactKeyValueList(pdf, t.approval, approvalValues, MARGIN, 243, CONTENT_WIDTH, 31, approvalValues.length);
}

function collectScoreRows(intervention?: CoachingIntervention): ScoreRow[] {
  if (!intervention) return [];
  if (intervention.scores.length) {
    return intervention.scores.flatMap((score) => score.value === "NVT" ? [] : [{
      group: score.focus,
      criterion: score.criterion,
      current: Number(score.value),
      previous: score.previousScore,
      comment: score.description,
    }]);
  }
  const dossier = intervention.dossier;
  if (!dossier) return [];
  return [
    ...dossier.generalScores.map((score) => simpleScoreRow(score, translations.nl.generalEvaluation)),
    ...dossier.personalityScores.map((score) => simpleScoreRow(score, translations.nl.personality)),
  ].filter((row): row is ScoreRow => Boolean(row));
}

function simpleScoreRow(score: CoachingSimpleScore, group: string): ScoreRow | undefined {
  if (score.score === "nvt") return undefined;
  return { group, criterion: score.criterion, current: score.score * 20, previous: score.previousScore === undefined ? undefined : score.previousScore * 20, comment: score.comment };
}

function drawPerformanceWheel(pdf: Pdf, rows: ScoreRow[], centerX: number, centerY: number, radius: number) {
  const usable = rows.slice(0, 24);
  const count = Math.max(3, usable.length);
  pdf.setFillColor("#F8FAFC");
  pdf.circle(centerX, centerY, radius + 3, "F");
  for (const percentage of [20, 40, 60, 80, 100]) {
    pdf.setDrawColor(SLATE_300);
    pdf.setLineWidth(percentage === 100 ? 0.45 : 0.22);
    pdf.circle(centerX, centerY, radius * percentage / 100, "S");
  }
  const points = usable.map((row, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / count);
    const outerX = centerX + Math.cos(angle) * radius;
    const outerY = centerY + Math.sin(angle) * radius;
    pdf.setDrawColor("#FFFFFF");
    pdf.setLineWidth(0.6);
    pdf.line(centerX, centerY, outerX, outerY);
    const factor = Math.max(0, Math.min(100, row.current)) / 100;
    return { x: centerX + Math.cos(angle) * radius * factor, y: centerY + Math.sin(angle) * radius * factor };
  });
  if (points.length > 1) {
    pdf.setDrawColor(BLUE);
    pdf.setLineWidth(1.1);
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      pdf.line(point.x, point.y, next.x, next.y);
      const row = usable[index];
      const difference = row.previous === undefined ? undefined : row.current - row.previous;
      pdf.setFillColor(difference === undefined || difference === 0 ? MID_BLUE : difference > 0 ? GREEN : RED);
      pdf.circle(point.x, point.y, 1.7, "F");
    });
  }
  pdf.setFillColor("#FFFFFF");
  pdf.setDrawColor(LIGHT_BLUE);
  pdf.circle(centerX, centerY, 10, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(BLUE);
  pdf.text(rows.length ? scoreLabel(averageOf(rows.map((row) => row.current))) : "-", centerX, centerY + 1, { align: "center" });

}

function drawAppointmentScores(pdf: Pdf, input: ProfessionalCoachingReportInput, scores: CoachingSimpleScore[], startY: number, continuationTitle: string) {
  const t = translations[input.language];
  const widths = [28, 52, 17, 17, 18, 46];
  const headers = [t.summary, t.criterion, t.previous, t.current, t.difference, t.remarks];
  let y = drawTableHeader(pdf, headers, widths, startY);
  for (const score of scores.filter((item) => item.score !== "nvt" || item.comment)) {
    const [group, ...criterionParts] = score.criterion.split(" - ");
    const criterion = criterionParts.length ? criterionParts.join(" - ") : score.criterion;
    const category = criterionParts.length ? group : t.generalEvaluation;
    const commentLines = pdf.splitTextToSize(score.comment || "", 40) as string[];
    const criterionLines = pdf.splitTextToSize(criterion, 46) as string[];
    const height = Math.max(8.5, 5 + Math.max(commentLines.length, criterionLines.length) * 3);
    if (y + height > CONTENT_BOTTOM) {
      addWhitePage(pdf);
      drawSectionHeading(pdf, `${continuationTitle} - ${t.continued}`, fullName(input.representative));
      y = drawTableHeader(pdf, headers, widths, 47);
    }
    pdf.setFillColor(Math.round(y) % 2 ? "#FFFFFF" : SLATE_100);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, height, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(SLATE_700);
    pdf.text(pdf.splitTextToSize(category, 31) as string[], MARGIN + 3, y + 5);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(SLATE_950);
    pdf.text(criterionLines, MARGIN + 40, y + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(SLATE_700);
    pdf.text(score.previousScore === undefined ? "-" : `${score.previousScore}/5`, MARGIN + 83, y + 5);
    pdf.text(score.score === "nvt" ? "-" : `${score.score}/5`, MARGIN + 100, y + 5);
    const difference = score.score === "nvt" || score.previousScore === undefined ? undefined : Number(score.score) - score.previousScore;
    pdf.setTextColor(difference === undefined || difference === 0 ? MID_BLUE : difference > 0 ? GREEN : RED);
    pdf.text(difference === undefined ? "-" : difference > 0 ? `+${difference}` : String(difference), MARGIN + 117, y + 5);
    if (commentLines.length) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.1);
      pdf.setTextColor(SLATE_700);
      pdf.text(commentLines, MARGIN + 135, y + 5);
    }
    y += height;
  }
  return y;
}

function drawHeadersAndFooters(pdf: Pdf, input: ProfessionalCoachingReportInput, logo?: string) {
  const t = translations[input.language];
  const total = pdf.getNumberOfPages();
  const date = formatDate(input.intervention.plannedDate ?? input.intervention.createdAt, input.language);
  for (let page = 1; page <= total; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      if (logo) pdf.addImage(logo, "PNG", MARGIN, 9, 29, 9.5, undefined, "FAST");
      else drawWordmark(pdf, MARGIN, 15);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(BLUE);
      pdf.text(t.report, PAGE_WIDTH - MARGIN, 12, { align: "right" });
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(SLATE_500);
      pdf.text(`${fullName(input.representative)} | ${date} | ${localizedValue(input.intervention.status, input.language)}`, PAGE_WIDTH - MARGIN, 17, { align: "right" });
      pdf.setDrawColor(SLATE_300);
      pdf.line(MARGIN, 22, PAGE_WIDTH - MARGIN, 22);
    }
    pdf.setDrawColor(SLATE_300);
    pdf.line(MARGIN, 284, PAGE_WIDTH - MARGIN, 284);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(SLATE_500);
    pdf.text(`MExT FieldForce | ${fullName(input.representative)} | Export ${formatDate(new Date().toISOString(), input.language)} | Rapport v2.0`, MARGIN, 290);
    pdf.text(`${t.page} ${page} ${t.of} ${total}`, PAGE_WIDTH - MARGIN, 290, { align: "right" });
  }
}

function drawSectionHeading(pdf: Pdf, title: string, subtitle: string) {
  pdf.setFillColor(BLUE);
  pdf.roundedRect(MARGIN, CONTENT_TOP, CONTENT_WIDTH, 13, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor("#FFFFFF");
  pdf.text(title, MARGIN + 5, CONTENT_TOP + 8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(subtitle, PAGE_WIDTH - MARGIN - 5, CONTENT_TOP + 8.3, { align: "right" });
}

function drawInfoGrid(pdf: Pdf, values: string[][], startY: number, columns = 3, cardHeight = 39) {
  const gap = 4;
  const width = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  values.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (width + gap);
    const y = startY + row * (cardHeight + gap);
    drawRoundedCard(pdf, x, y, width, cardHeight, column % 2 ? "#FFFFFF" : "#F8FAFC");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(BLUE);
    pdf.text(label.toUpperCase(), x + 4, y + 7, { maxWidth: width - 8 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.2);
    pdf.setTextColor(SLATE_950);
    const lines = pdf.splitTextToSize(value, width - 8) as string[];
    pdf.text(lines.slice(0, Math.max(1, Math.floor((cardHeight - 13) / 4))), x + 4, y + 15);
  });
  return startY + Math.ceil(values.length / columns) * (cardHeight + gap);
}

function drawPairedTextCards(pdf: Pdf, values: string[][], startY: number) {
  const gap = 4;
  const width = values.length > 1 ? (CONTENT_WIDTH - gap) / 2 : CONTENT_WIDTH;
  const prepared = values.map(([label, value]) => ({
    label,
    lines: pdf.splitTextToSize(value, width - 10) as string[],
  }));
  const height = Math.max(22, 15 + Math.max(...prepared.map((item) => item.lines.length)) * 3.6);
  prepared.forEach((item, index) => {
    const x = MARGIN + index * (width + gap);
    drawRoundedCard(pdf, x, startY, width, height, "#F8FAFC");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(BLUE);
    pdf.text(item.label.toUpperCase(), x + 4, startY + 7);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.6);
    pdf.setTextColor(SLATE_700);
    pdf.text(item.lines, x + 4, startY + 14);
  });
  return startY + height + 4;
}

function drawCompactKeyValueList(
  pdf: Pdf,
  title: string,
  values: string[][],
  x: number,
  y: number,
  width: number,
  height: number,
  columns = 1
) {
  drawRoundedCard(pdf, x, y, width, height, "#F8FAFC");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(BLUE);
  pdf.text(title.toUpperCase(), x + 4, y + 7);
  const rows = Math.max(1, Math.ceil(values.length / columns));
  const cellWidth = (width - 8) / columns;
  const rowHeight = Math.min(15, (height - 12) / rows);
  values.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellX = x + 4 + column * cellWidth;
    const cellY = y + 14 + row * rowHeight;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.8);
    pdf.setTextColor(SLATE_500);
    pdf.text(label.toUpperCase(), cellX, cellY, { maxWidth: cellWidth - 3 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.3);
    pdf.setTextColor(SLATE_950);
    pdf.text(String(value), cellX, cellY + 4, { maxWidth: cellWidth - 3 });
  });
  return y + height;
}

function drawInsightCard(pdf: Pdf, title: string, lines: string[], x: number, y: number, width: number, color: string, height = 47) {
  drawRoundedCard(pdf, x, y, width, height, "#F8FAFC");
  pdf.setFillColor(color);
  pdf.roundedRect(x, y, 2.5, height, 1.2, 1.2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.3);
  pdf.setTextColor(color);
  pdf.text(title.toUpperCase(), x + 6, y + 7, { maxWidth: width - 10 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.8);
  pdf.setTextColor(SLATE_700);
  const display = lines.length ? lines : ["-"];
  const maximumLines = height < 40 ? 3 : 5;
  display.slice(0, maximumLines).forEach((line, index) => {
    const prefix = /^\d+[./]/.test(line) ? "" : "- ";
    pdf.text(`${prefix}${line}`, x + 6, y + 15 + index * 6, { maxWidth: width - 10 });
  });
}

function categoryEvolutionLines(rows: ScoreRow[]) {
  const groups = new Map<string, ScoreRow[]>();
  rows.forEach((row) => groups.set(row.group || "Algemeen", [...(groups.get(row.group || "Algemeen") ?? []), row]));
  return [...groups.entries()].map(([group, groupRows]) => {
    const current = averageOf(groupRows.map((row) => row.current));
    const previousRows = groupRows.filter((row) => row.previous !== undefined);
    const previous = previousRows.length ? averageOf(previousRows.map((row) => row.previous!)) : undefined;
    return `${group}: ${scoreLabel(current)}${previous === undefined ? "" : ` (${signedScore(current - previous)})`}`;
  });
}

function drawCoachingRemarks(pdf: Pdf, input: ProfessionalCoachingReportInput, rows: ScoreRow[], startY: number) {
  const t = translations[input.language];
  const remarks = rows.filter((row) => row.comment?.trim());
  if (!remarks.length) return startY;
  let y = drawCardTitle(pdf, t.remarks, startY);
  for (const row of remarks) {
    const lines = pdf.splitTextToSize(row.comment!, CONTENT_WIDTH - 18) as string[];
    const height = Math.max(16, 11 + lines.length * 3.4);
    if (y + height > CONTENT_BOTTOM) {
      addWhitePage(pdf);
      drawSectionHeading(pdf, `${t.remarks} - ${t.continued}`, fullName(input.representative));
      y = 48;
    }
    drawRoundedCard(pdf, MARGIN, y, CONTENT_WIDTH, height, "#F8FAFC");
    pdf.setFillColor(MID_BLUE);
    pdf.circle(MARGIN + 6, y + 7, 2.2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.1);
    pdf.setTextColor(BLUE);
    pdf.text(`${row.group} - ${row.criterion}`, MARGIN + 11, y + 7, { maxWidth: CONTENT_WIDTH - 16 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.2);
    pdf.setTextColor(SLATE_700);
    pdf.text(lines, MARGIN + 11, y + 12);
    y += height + 3;
  }
  return y;
}

function drawActionPointsTable(pdf: Pdf, input: ProfessionalCoachingReportInput, startY: number) {
  const t = translations[input.language];
  let y = startY;
  if (y + 22 > CONTENT_BOTTOM) {
    addWhitePage(pdf);
    drawSectionHeading(pdf, t.actionPoints, fullName(input.representative));
    y = 48;
  } else {
    y = drawCardTitle(pdf, t.actionPoints, y);
  }
  const widths = [22, 68, 34, 30, 24];
  y = drawTableHeader(pdf, [t.priority, t.actionPoints, t.owner, t.deadline, t.status], widths, y + 1);
  for (const action of input.intervention.actionPoints) {
    const actionText = action.description?.trim() ? `${action.title}\n${action.description}` : action.title;
    const titleLines = pdf.splitTextToSize(actionText, 62) as string[];
    const height = Math.max(9, 5 + titleLines.length * 3.2);
    if (y + height > CONTENT_BOTTOM) {
      addWhitePage(pdf);
      drawSectionHeading(pdf, `${t.actionPoints} - ${t.continued}`, fullName(input.representative));
      y = drawTableHeader(pdf, [t.priority, t.actionPoints, t.owner, t.deadline, t.status], widths, 47);
    }
    pdf.setFillColor(Math.round(y) % 2 ? "#FFFFFF" : SLATE_100);
    pdf.rect(MARGIN, y, CONTENT_WIDTH, height, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.6);
    pdf.setTextColor(SLATE_700);
    pdf.text(localizedValue(action.priority ?? "normaal", input.language), MARGIN + 3, y + 5);
    pdf.text(titleLines, MARGIN + 25, y + 5);
    pdf.text(resolveActionOwner(action.owner ?? "", input), MARGIN + 93, y + 5, { maxWidth: 30 });
    pdf.text(action.due ? formatDate(action.due, input.language) : "-", MARGIN + 127, y + 5, { maxWidth: 26 });
    pdf.text(localizedValue(action.status, input.language), MARGIN + 157, y + 5, { maxWidth: 18 });
    y += height;
  }
  return y;
}

function drawTableHeader(pdf: Pdf, headers: string[], widths: number[], y: number) {
  pdf.setFillColor(BLUE);
  pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, 9, 2, 2, "F");
  let x = MARGIN;
  headers.forEach((header, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.3);
    pdf.setTextColor("#FFFFFF");
    pdf.text(header.toUpperCase(), x + 3, y + 6, { maxWidth: widths[index] - 6 });
    x += widths[index];
  });
  return y + 9;
}

function drawScoreRow(pdf: Pdf, row: ScoreRow, trend: string, difference: number | undefined, y: number, height: number) {
  pdf.setFillColor(Math.round(y) % 2 ? "#FFFFFF" : SLATE_100);
  pdf.rect(MARGIN, y, CONTENT_WIDTH, height, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(SLATE_500);
  pdf.text(row.group, MARGIN + 3, y + 5.5, { maxWidth: 30 });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(SLATE_950);
  pdf.text(row.criterion, MARGIN + 38, y + 5.5, { maxWidth: 64 });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.3);
  pdf.setTextColor(SLATE_700);
  pdf.text(row.previous === undefined ? "-" : scoreLabel(row.previous), MARGIN + 107, y + 5.5);
  pdf.text(scoreLabel(row.current), MARGIN + 127, y + 5.5);
  const color = difference === undefined || difference === 0 ? MID_BLUE : difference > 0 ? GREEN : RED;
  drawBadge(pdf, difference === undefined ? trend : `${signedScore(difference)} ${trend}`, MARGIN + 147, y + 2.2, color);
}

function drawCardTitle(pdf: Pdf, title: string, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(BLUE);
  pdf.text(title, MARGIN, y);
  return y + 4;
}

function drawRoundedCard(pdf: Pdf, x: number, y: number, width: number, height: number, fill: string) {
  pdf.setFillColor(fill);
  pdf.setDrawColor(SLATE_300);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, width, height, 3, 3, "FD");
}

function addWhitePage(pdf: Pdf) {
  pdf.addPage();
  paintWhiteBackground(pdf);
}

function paintWhiteBackground(pdf: Pdf) {
  pdf.setFillColor("#FFFFFF");
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
}

function drawBadge(pdf: Pdf, text: string, x: number, y: number, color: string) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  const width = Math.min(39, Math.max(13, pdf.getTextWidth(text) + 6));
  pdf.setFillColor(color);
  pdf.roundedRect(x, y, width, 6, 2.5, 2.5, "F");
  pdf.setTextColor("#FFFFFF");
  pdf.text(text, x + width / 2, y + 4.1, { align: "center", maxWidth: width - 3 });
}

function drawWordmark(pdf: Pdf, x: number, y: number) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(BLUE);
  pdf.text("MExT", x, y);
  pdf.setFontSize(6);
  pdf.text("FIELDFORCE", x, y + 4);
}

async function loadLogoDataUrl() {
  if (typeof window === "undefined") return undefined;
  try {
    const response = await fetch("/assets/fieldforce-logo-tight.png");
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function durationLabel(start?: string, end?: string) {
  if (!start || !end) return "";
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const hours = Math.floor(minutes / 60);
  return `${hours ? `${hours}u ` : ""}${minutes % 60}m`;
}

function formatDate(value: string, language: Language) {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(value: string, language: Language) {
  const locale = language === "fr" ? "fr-BE" : language === "de" ? "de-DE" : "nl-BE";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function scoreLabel(value: number) {
  return `${Math.round(value)}%`;
}

function signedScore(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function averageOf(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function fullName(representative: Representative) {
  return `${representative.firstName} ${representative.lastName}`.trim();
}

function localizedValue(value: string, language: Language) {
  const normalized = value.toLowerCase();
  const values: Record<Language, Record<string, string>> = {
    nl: {
      klant: "Klant", prospect: "Prospect", vast: "Vast", rood: "Rood",
      laag: "Laag", normaal: "Normaal", hoog: "Hoog", open: "Open",
      nieuw: "Nieuw", in_uitvoering: "In uitvoering", afgerond: "Afgerond",
      behaald: "Behaald", niet_behaald: "Niet behaald", geannuleerd: "Geannuleerd",
      concept: "Concept", gepland: "Gepland", gesloten: "Gesloten",
      gefinaliseerd: "Gefinaliseerd", afgesloten: "Afgesloten",
      voltooid: "Afgewerkt", verzonden_ter_akkoord: "Ter akkoord verzonden", akkoord_door_vertegenwoordiger: "Voor akkoord bevestigd",
      wacht_op_vt: "Wacht op vertegenwoordiger", wacht_op_akkoord: "Wacht op akkoord",
    },
    fr: {
      klant: "Client", prospect: "Prospect", vast: "Fixe", rood: "Urgent",
      laag: "Basse", normaal: "Normale", hoog: "Haute", open: "Ouvert",
      nieuw: "Nouveau", in_uitvoering: "En cours", afgerond: "Terminé",
      behaald: "Atteint", niet_behaald: "Non atteint", geannuleerd: "Annulé",
      concept: "Brouillon", gepland: "Planifié", gesloten: "Clôturé",
      gefinaliseerd: "Finalisé", afgesloten: "Terminé",
      voltooid: "Terminé", verzonden_ter_akkoord: "Envoyé pour accord", akkoord_door_vertegenwoordiger: "Accord confirmé",
      wacht_op_vt: "En attente du représentant", wacht_op_akkoord: "En attente d'accord",
    },
    de: {
      klant: "Kunde", prospect: "Interessent", vast: "Fest", rood: "Dringend",
      laag: "Niedrig", normaal: "Normal", hoog: "Hoch", open: "Offen",
      nieuw: "Neu", in_uitvoering: "In Bearbeitung", afgerond: "Abgeschlossen",
      behaald: "Erreicht", niet_behaald: "Nicht erreicht", geannuleerd: "Storniert",
      concept: "Entwurf", gepland: "Geplant", gesloten: "Geschlossen",
      gefinaliseerd: "Finalisiert", afgesloten: "Abgeschlossen",
      voltooid: "Abgeschlossen", verzonden_ter_akkoord: "Zur Bestätigung gesendet", akkoord_door_vertegenwoordiger: "Bestätigt",
      wacht_op_vt: "Warten auf Vertreter", wacht_op_akkoord: "Warten auf Zustimmung",
    },
  };
  return values[language][normalized] ?? normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveActionOwner(owner: string, input: ProfessionalCoachingReportInput) {
  if (owner === input.representative.id || owner === input.intervention.representativeId) {
    return fullName(input.representative);
  }
  if (owner === input.intervention.ownerId || owner === input.intervention.initiatorId) {
    return input.leaderName;
  }
  return owner;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}
