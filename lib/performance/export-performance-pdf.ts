import type { jsPDF } from "jspdf";
import {
  formatPerformancePercentage,
  performanceTrendColor,
} from "@/lib/performance/performance-wheel";
import type {
  PerformanceTrend,
  PerformanceWheelCriterion,
  PerformanceWheelData,
} from "@/lib/performance/performance-wheel";

const PAGE_WIDTH = 210;
const MARGIN = 14;
const CONTENT_BOTTOM = 279;
const BRAND_BLUE = "#003B83";
const SLATE_950 = "#172033";
const SLATE_600 = "#64748B";
const SLATE_400 = "#94A3B8";
const BORDER = "#DCE3EC";

type ExportPerformancePdfOptions = {
  representativeName: string;
  coachingDate: string;
  comparisonDate?: string;
  modeLabel: string;
  data: PerformanceWheelData;
  svgElement: SVGSVGElement;
  notScoredLabel?: string;
  totalScoreLabel?: string;
  preview?: boolean;
};

type PdfGroup = {
  category: string;
  rows: PerformanceWheelCriterion[];
  average?: number;
  trend: PerformanceTrend;
};

type PreparedRow = {
  criterion: string[];
  previous: string;
  current: string;
  difference: string;
  trend: PerformanceTrend;
  height: number;
};

export async function exportPerformancePdf({
  representativeName,
  coachingDate,
  comparisonDate,
  modeLabel,
  data,
  svgElement,
  notScoredLabel = "Niet gescoord",
  totalScoreLabel = "Totale score",
  preview = false,
}: ExportPerformancePdfOptions) {
  const [{ jsPDF }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const exportDate = new Date();
  const exportDateLabel = formatDate(exportDate);

  drawFirstPageIntro(pdf, {
    representativeName,
    coachingDate,
    comparisonDate,
    modeLabel,
  });

  const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgClone.setAttribute("width", "1000");
  svgClone.setAttribute("height", "1000");
  await pdf.svg(svgClone, { x: 18, y: 53, width: 174, height: 174 });

  drawFirstPageSummary(pdf, data, notScoredLabel, totalScoreLabel);
  drawScorePages(pdf, groupCriteria(data), notScoredLabel);
  drawHeadersAndFooters(pdf, representativeName, exportDateLabel);

  const filenameDate = exportDate.toISOString().slice(0, 10);
  const filename = `fieldforce-prestatiecirkel-${slugify(representativeName)}-${filenameDate}.pdf`;
  const output = pdf.output("arraybuffer");
  const signature = new TextDecoder().decode(new Uint8Array(output, 0, 4));
  if (signature !== "%PDF" || output.byteLength < 1_000) {
    throw new Error("De gegenereerde PDF is ongeldig.");
  }

  const previewUrl = preview
    ? URL.createObjectURL(new Blob([output], { type: "application/pdf" }))
    : undefined;
  if (!preview) {
    pdf.save(filename);
  }
  return {
    filename,
    pageCount: pdf.getNumberOfPages(),
    byteLength: output.byteLength,
    previewUrl,
  };
}

function drawFirstPageIntro(
  pdf: jsPDF,
  details: {
    representativeName: string;
    coachingDate: string;
    comparisonDate?: string;
    modeLabel: string;
  }
) {
  pdf.setTextColor(BRAND_BLUE);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.text("Prestatiecirkel", MARGIN, 35);

  pdf.setTextColor(SLATE_950);
  pdf.setFontSize(14);
  pdf.text(details.representativeName, MARGIN, 43);

  pdf.setTextColor(SLATE_600);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(`${details.modeLabel} - begeleiding ${details.coachingDate}`, MARGIN, 49);
  pdf.text(
    details.comparisonDate
      ? `Vergelijking met ${details.comparisonDate}`
      : "Eerste meting - geen vorige begeleiding beschikbaar",
    PAGE_WIDTH - MARGIN,
    49,
    { align: "right" }
  );
}

function drawFirstPageSummary(
  pdf: jsPDF,
  data: PerformanceWheelData,
  notScoredLabel: string,
  totalScoreLabel: string
) {
  pdf.setDrawColor(BORDER);
  pdf.setFillColor("#FFFFFF");
  pdf.roundedRect(MARGIN, 232, PAGE_WIDTH - MARGIN * 2, 39, 4, 4, "FD");

  const legend = [
    { color: "#22C55E", label: "Groen = beter dan vorige keer" },
    { color: "#EF4444", label: "Rood = slechter dan vorige keer" },
    { color: BRAND_BLUE, label: "Blauw/grijs = gelijk of eerste meting" },
  ];

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(BRAND_BLUE);
  pdf.setFontSize(9);
  pdf.text("LEGENDE", MARGIN + 6, 241);

  legend.forEach((item, index) => {
    const y = 248 + index * 6;
    pdf.setFillColor(item.color);
    pdf.circle(MARGIN + 7.5, y - 1, 1.6, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(SLATE_600);
    pdf.setFontSize(8.5);
    pdf.text(item.label, MARGIN + 12, y);
  });

  pdf.setFillColor("#EFF6FF");
  pdf.setDrawColor("#BFDBFE");
  pdf.roundedRect(154, 241, 36, 22, 3, 3, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(BRAND_BLUE);
  pdf.setFontSize(17);
  pdf.text(formatPerformancePercentage(data.totalPercentage, notScoredLabel), 172, 251, { align: "center" });
  pdf.setFontSize(7.5);
  pdf.text(totalScoreLabel.toUpperCase(), 172, 258, { align: "center" });
}

function drawScorePages(pdf: jsPDF, groups: PdfGroup[], notScoredLabel: string) {
  pdf.addPage();
  let y = 33;

  for (const group of groups) {
    const rows = group.rows.map((row) => prepareRow(pdf, row, notScoredLabel));
    const fullHeight = 20 + rows.reduce((sum, row) => sum + row.height, 0);
    if (fullHeight <= CONTENT_BOTTOM - 33 && y + fullHeight > CONTENT_BOTTOM) {
      pdf.addPage();
      y = 33;
    }

    let rowIndex = 0;
    let continuation = false;
    while (rowIndex < rows.length) {
      const available = CONTENT_BOTTOM - y;
      const chunk: PreparedRow[] = [];
      let chunkHeight = 20;

      while (
        rowIndex + chunk.length < rows.length &&
        chunkHeight + rows[rowIndex + chunk.length].height <= available
      ) {
        const row = rows[rowIndex + chunk.length];
        chunk.push(row);
        chunkHeight += row.height;
      }

      if (chunk.length === 0) {
        pdf.addPage();
        y = 33;
        continue;
      }

      drawPhaseBlock(pdf, displayCategory(group.category), chunk, group.average, group.trend, notScoredLabel, y, continuation);
      y += chunkHeight + 5;
      rowIndex += chunk.length;
      continuation = rowIndex < rows.length;

      if (continuation) {
        pdf.addPage();
        y = 33;
      }
    }
  }
}

function drawPhaseBlock(
  pdf: jsPDF,
  category: string,
  rows: PreparedRow[],
  average: number | undefined,
  trend: PerformanceTrend,
  notScoredLabel: string,
  y: number,
  continuation: boolean
) {
  const cardHeight = 20 + rows.reduce((sum, row) => sum + row.height, 0);
  pdf.setFillColor("#FFFFFF");
  pdf.setDrawColor(BORDER);
  pdf.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, cardHeight, 3, 3, "FD");

  pdf.setFillColor("#EFF6FF");
  pdf.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 10, 3, 3, "F");
  pdf.rect(MARGIN, y + 6, PAGE_WIDTH - MARGIN * 2, 4, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(trendTextColor(trend));
  pdf.setFontSize(10.5);
  const scoreLabel = formatPerformancePercentage(average, notScoredLabel);
  pdf.text(`${category}${continuation ? " (vervolg)" : ""} - ${scoreLabel}`, MARGIN + 5, y + 6.5);

  const columnY = y + 16.5;
  pdf.setFontSize(7.5);
  pdf.setTextColor(SLATE_400);
  pdf.text("CRITERIUM", MARGIN + 5, columnY);
  pdf.text("VORIG", 112, columnY, { align: "center" });
  pdf.text("HUIDIG", 130, columnY, { align: "center" });
  pdf.text("VERSCHIL", 151, columnY, { align: "center" });
  pdf.text("TREND", 178, columnY, { align: "center" });

  let rowY = y + 20;
  rows.forEach((row, index) => {
    if (index > 0) {
      pdf.setDrawColor("#E8EDF3");
      pdf.line(MARGIN + 4, rowY, PAGE_WIDTH - MARGIN - 4, rowY);
    }

    const criterionHeight = row.criterion.length * 3.8;
    const textY = rowY + (row.height - criterionHeight) / 2 + 3;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(SLATE_950);
    pdf.setFontSize(8.2);
    pdf.text(row.criterion, MARGIN + 5, textY);

    pdf.setTextColor(SLATE_600);
    pdf.text(row.previous, 112, textY, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(SLATE_950);
    pdf.text(row.current, 130, textY, { align: "center" });

    drawStatusBadge(pdf, row.difference, 151, rowY + row.height / 2, row.trend, 25, "difference");
    drawStatusBadge(pdf, trendLabel(row.trend), 178, rowY + row.height / 2, row.trend, 35, "trend");
    rowY += row.height;
  });
}

function drawStatusBadge(
  pdf: jsPDF,
  label: string,
  centerX: number,
  centerY: number,
  trend: PerformanceTrend,
  width: number,
  kind: "difference" | "trend"
) {
  const colors = trendColors(trend);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(kind === "trend" ? 7.2 : 7.5);
  pdf.setFillColor(colors.fill);
  pdf.setDrawColor(colors.border);
  pdf.roundedRect(centerX - width / 2, centerY - 3.8, width, 7.6, 2.8, 2.8, "FD");
  drawTrendIcon(pdf, centerX - width / 2 + 5, centerY, trend);
  pdf.setTextColor(colors.text);
  pdf.text(label, centerX + 3, centerY + 1.1, { align: "center" });
}

function drawTrendIcon(pdf: jsPDF, centerX: number, centerY: number, trend: PerformanceTrend) {
  const colors = trendColors(trend);
  pdf.setDrawColor(colors.text);
  pdf.setFillColor(colors.text);
  pdf.setLineWidth(0.55);

  if (trend === "first") {
    pdf.circle(centerX, centerY, 1.1, "F");
    return;
  }

  if (trend === "equal") {
    pdf.line(centerX - 2, centerY, centerX + 2, centerY);
    pdf.line(centerX + 2, centerY, centerX + 0.7, centerY - 1.1);
    pdf.line(centerX + 2, centerY, centerX + 0.7, centerY + 1.1);
    return;
  }

  const pointsUp = trend === "better";
  const startY = pointsUp ? centerY + 2 : centerY - 2;
  const endY = pointsUp ? centerY - 2 : centerY + 2;
  const headOffset = pointsUp ? 1.1 : -1.1;
  pdf.line(centerX, startY, centerX, endY);
  pdf.line(centerX, endY, centerX - 1.4, endY + headOffset);
  pdf.line(centerX, endY, centerX + 1.4, endY + headOffset);
}

function drawHeadersAndFooters(pdf: jsPDF, representativeName: string, exportDate: string) {
  const totalPages = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    pdf.setPage(pageNumber);
    pdf.setFillColor(BRAND_BLUE);
    pdf.rect(0, 0, PAGE_WIDTH, 3.5, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(BRAND_BLUE);
    pdf.setFontSize(9);
    pdf.text("Prestatiecirkel", MARGIN, 13);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(SLATE_600);
    pdf.setFontSize(8);
    pdf.text(representativeName, MARGIN, 19);
    pdf.text(`Exportdatum: ${exportDate}`, PAGE_WIDTH - MARGIN, 19, { align: "right" });

    pdf.setDrawColor(BORDER);
    pdf.line(MARGIN, 24, PAGE_WIDTH - MARGIN, 24);
    pdf.line(MARGIN, 285, PAGE_WIDTH - MARGIN, 285);

    pdf.setTextColor(SLATE_600);
    pdf.setFontSize(7.5);
    pdf.text("FieldForce - Grow. Coach. Perform.", MARGIN, 291);
    pdf.text(`Pagina ${pageNumber} van ${totalPages}`, PAGE_WIDTH - MARGIN, 291, { align: "right" });
  }
}

function prepareRow(pdf: jsPDF, row: PerformanceWheelCriterion, notScoredLabel: string): PreparedRow {
  const criterion = pdf.splitTextToSize(row.criterion, 82) as string[];
  return {
    criterion,
    previous: row.previousTen === undefined ? "-" : formatScore(row.previousTen),
    current: row.currentScored ? formatScore(row.currentTen) : notScoredLabel,
    difference: formatDifference(row.differenceTen),
    trend: row.trend,
    height: Math.max(10.5, criterion.length * 3.8 + 4),
  };
}

function groupCriteria(data: PerformanceWheelData) {
  return data.criteria.reduce<PdfGroup[]>((groups, row) => {
    const existing = groups.find((group) => group.category === row.category);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({
        category: row.category,
        rows: [row],
        average: data.categories.find((category) => category.name === row.category)?.currentPercentage,
        trend: data.categories.find((category) => category.name === row.category)?.trend ?? "first",
      });
    }
    return groups;
  }, []);
}

function trendTextColor(trend: PerformanceTrend) {
  return performanceTrendColor(trend);
}

function trendColors(trend: PerformanceTrend) {
  return {
    better: { fill: "#DCFCE7", border: "#BBF7D0", text: "#166534" },
    worse: { fill: "#FEE2E2", border: "#FECACA", text: "#991B1B" },
    equal: { fill: "#E2E8F0", border: "#CBD5E1", text: "#475569" },
    first: { fill: "#DBEAFE", border: "#BFDBFE", text: "#1E40AF" },
  }[trend];
}

function trendLabel(trend: PerformanceTrend) {
  return {
    better: "Beter",
    worse: "Slechter",
    equal: "Gelijk",
    first: "Eerste meting",
  }[trend];
}

function formatDifference(difference?: number) {
  if (difference === undefined) return "-";
  if (difference > 0) return `+${formatScore(difference)}`;
  return formatScore(difference);
}

function formatScore(value: number) {
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 1 });
}

function formatDate(value: Date) {
  return value.toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function displayCategory(category: string) {
  return category === "Koffercontrole" ? "Klantcontrole" : category;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
