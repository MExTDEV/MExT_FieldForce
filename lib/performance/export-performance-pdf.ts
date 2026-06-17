import type { jsPDF } from "jspdf";
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
  preview?: boolean;
};

type PdfGroup = {
  category: string;
  rows: PerformanceWheelCriterion[];
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

  drawFirstPageSummary(pdf, data);
  drawScorePages(pdf, groupCriteria(data.criteria));
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

function drawFirstPageSummary(pdf: jsPDF, data: PerformanceWheelData) {
  const average = data.criteria.reduce((sum, row) => sum + row.currentTen, 0) /
    Math.max(1, data.criteria.length);

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
  pdf.text(formatScore(average), 172, 251, { align: "center" });
  pdf.setFontSize(7.5);
  pdf.text("GEMIDDELDE SCORE", 172, 258, { align: "center" });
}

function drawScorePages(pdf: jsPDF, groups: PdfGroup[]) {
  pdf.addPage();
  let y = 33;

  for (const group of groups) {
    const rows = group.rows.map((row) => prepareRow(pdf, row));
    const fullHeight = 18 + rows.reduce((sum, row) => sum + row.height, 0);
    if (fullHeight <= CONTENT_BOTTOM - 33 && y + fullHeight > CONTENT_BOTTOM) {
      pdf.addPage();
      y = 33;
    }

    let rowIndex = 0;
    let continuation = false;
    while (rowIndex < rows.length) {
      const available = CONTENT_BOTTOM - y;
      const chunk: PreparedRow[] = [];
      let chunkHeight = 18;

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

      drawPhaseBlock(pdf, displayCategory(group.category), chunk, y, continuation);
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
  y: number,
  continuation: boolean
) {
  const cardHeight = 18 + rows.reduce((sum, row) => sum + row.height, 0);
  pdf.setFillColor("#FFFFFF");
  pdf.setDrawColor(BORDER);
  pdf.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, cardHeight, 3, 3, "FD");

  pdf.setFillColor("#EFF6FF");
  pdf.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 10, 3, 3, "F");
  pdf.rect(MARGIN, y + 6, PAGE_WIDTH - MARGIN * 2, 4, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(BRAND_BLUE);
  pdf.setFontSize(10.5);
  pdf.text(`${category}${continuation ? " (vervolg)" : ""}`, MARGIN + 5, y + 6.5);

  const columnY = y + 15.5;
  pdf.setFontSize(7.5);
  pdf.setTextColor(SLATE_400);
  pdf.text("CRITERIUM", MARGIN + 5, columnY);
  pdf.text("V", 112, columnY, { align: "center" });
  pdf.text("H", 130, columnY, { align: "center" });
  pdf.text("VERSCHIL", 151, columnY, { align: "center" });
  pdf.text("TREND", 178, columnY, { align: "center" });

  let rowY = y + 18;
  rows.forEach((row, index) => {
    if (index > 0) {
      pdf.setDrawColor("#E8EDF3");
      pdf.line(MARGIN + 4, rowY, PAGE_WIDTH - MARGIN - 4, rowY);
    }

    const textY = rowY + 4.6;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(SLATE_950);
    pdf.setFontSize(8.2);
    pdf.text(row.criterion, MARGIN + 5, textY);

    pdf.setTextColor(SLATE_600);
    pdf.text(row.previous, 112, textY, { align: "center" });
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(SLATE_950);
    pdf.text(row.current, 130, textY, { align: "center" });

    drawBadge(pdf, row.difference, 151, rowY + row.height / 2, row.trend, 18);
    drawBadge(pdf, trendLabel(row.trend), 178, rowY + row.height / 2, row.trend, 24);
    rowY += row.height;
  });
}

function drawBadge(
  pdf: jsPDF,
  label: string,
  centerX: number,
  centerY: number,
  trend: PerformanceTrend,
  maxWidth: number
) {
  const colors = trendColors(trend);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  const width = Math.min(maxWidth, Math.max(11, pdf.getTextWidth(label) + 6));
  pdf.setFillColor(colors.fill);
  pdf.setDrawColor(colors.border);
  pdf.roundedRect(centerX - width / 2, centerY - 3.2, width, 6.4, 2.5, 2.5, "FD");
  pdf.setTextColor(colors.text);
  pdf.text(label, centerX, centerY + 1, { align: "center" });
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

function prepareRow(pdf: jsPDF, row: PerformanceWheelCriterion): PreparedRow {
  const criterion = pdf.splitTextToSize(row.criterion, 82) as string[];
  return {
    criterion,
    previous: row.previousTen === undefined ? "-" : formatScore(row.previousTen),
    current: formatScore(row.currentTen),
    difference: formatDifference(row.differenceTen),
    trend: row.trend,
    height: Math.max(8, criterion.length * 3.8 + 3.5),
  };
}

function groupCriteria(criteria: PerformanceWheelCriterion[]) {
  return criteria.reduce<PdfGroup[]>((groups, row) => {
    const existing = groups.find((group) => group.category === row.category);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ category: row.category, rows: [row] });
    }
    return groups;
  }, []);
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
