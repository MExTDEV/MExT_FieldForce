"use client";

import { useMemo, useState } from "react";
import {
  formatPerformancePercentage,
  getPerformanceWheelData,
  performanceTrendColor,
  type PerformanceTrend,
  type PerformanceWheelType,
} from "@/lib/performance/performance-wheel";
import type { HistoricalCoaching } from "@/lib/performance-data";

const SIZE = 1000;
const CENTER = SIZE / 2;
const VIEWBOX_HORIZONTAL_MARGIN = 120;
const VIEWBOX_VERTICAL_MARGIN = 64;
const INNER_RADIUS = 54;
const PLOT_RADIUS = 286;
const BAND_INNER = 300;
const BAND_OUTER = 350;
const LABEL_RADIUS = 378;
const CATEGORY_COLORS = ["#dcecff", "#e8eff8", "#d9e7f7", "#e5edf7", "#d7e8f2"];

export type PerformanceWheelLabels = {
  noComparableScores: string;
  noCriteria: string;
  incomplete: string;
  ariaKapstok: string;
  ariaGeneral: string;
  previous: string;
  current: string;
  tooltipHelp: string;
  currentMeasurement: string;
  previousMeasurement: string;
  noPreviousMeasurement: string;
  better: string;
  worse: string;
  equal: string;
  first: string;
  green: string;
  red: string;
  darkBlue: string;
  blue: string;
};

const defaultLabels: PerformanceWheelLabels = {
  noComparableScores: "Geen vergelijkbare scores beschikbaar.",
  noCriteria: "Geen gescoorde criteria beschikbaar.",
  incomplete: "De prestatiecirkel kon niet volledig worden opgebouwd.",
  ariaKapstok: "Kapstok competentiewiel",
  ariaGeneral: "Algemeen competentiewiel",
  previous: "Vorige",
  current: "Huidige",
  tooltipHelp: "Beweeg over of tik op een criterium voor scoredetails.",
  currentMeasurement: "Huidige meting",
  previousMeasurement: "Vorige meting",
  noPreviousMeasurement: "Geen vorige meting",
  better: "Beter",
  worse: "Slechter",
  equal: "Gelijk",
  first: "Eerste meting",
  green: "groen",
  red: "rood",
  darkBlue: "donkerblauw",
  blue: "blauw",
};

export function PerformanceWheel({
  representativeId,
  currentInterventionId,
  comparisonInterventionId,
  type,
  coachings,
  notScoredLabel,
  totalScoreLabel,
  totalPercentageOverride,
  labels,
  compact = false,
}: {
  representativeId: string;
  currentInterventionId: string;
  comparisonInterventionId?: string;
  type: PerformanceWheelType;
  coachings: HistoricalCoaching[];
  notScoredLabel?: string;
  totalScoreLabel?: string;
  totalPercentageOverride?: number;
  labels?: Partial<PerformanceWheelLabels>;
  compact?: boolean;
}) {
  const data = useMemo(
    () => getPerformanceWheelData(
      representativeId,
      currentInterventionId,
      type,
      comparisonInterventionId,
      coachings
    ),
    [coachings, comparisonInterventionId, currentInterventionId, representativeId, type]
  );
  const [hoverId, setHoverId] = useState<string>();
  const [pinnedId, setPinnedId] = useState<string>();
  const activeId = pinnedId ?? hoverId;
  const active = data?.criteria.find((item) => item.id === activeId);
  const effectiveNotScoredLabel = notScoredLabel ?? "Niet gescoord";
  const effectiveTotalScoreLabel = totalScoreLabel ?? "Totale score";
  const effectiveLabels = { ...defaultLabels, ...labels };

  if (!data) {
    return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">{effectiveLabels.noComparableScores}</div>;
  }

  const count = data.criteria.length;
  if (count === 0) {
    return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">{effectiveLabels.noCriteria}</div>;
  }
  const angleStep = 360 / count;
  const currentPoints = data.criteria.map((item, index) =>
    polarPoint(CENTER, CENTER, scoreRadius(item.currentScore), centerAngle(index, angleStep))
  );
  const previousPoints = data.criteria.map((item, index) =>
    item.previousScore === undefined
      ? undefined
      : polarPoint(CENTER, CENTER, scoreRadius(item.previousScore), centerAngle(index, angleStep))
  );
  const previousCurveSegments = curveSegments(previousPoints);
  const criterionLabels = data.criteria.map((item) => item.criterion);
  if (criterionLabels.length !== currentPoints.length) {
    console.error("[performance-wheel] Het aantal labels en scorewaarden komt niet overeen.", {
      labels: criterionLabels.length,
      values: currentPoints.length,
      interventionId: data.currentInterventionId,
    });
    return <div className="rounded-2xl bg-rose-50 p-8 text-center text-sm text-rose-700">{effectiveLabels.incomplete}</div>;
  }

  return (
    <div>
      <div className={`mx-auto w-full ${compact ? "max-w-[360px]" : "max-w-[1040px]"}`}>
        <svg
          data-testid="performance-wheel-svg"
          fontFamily="Helvetica"
          viewBox={`${-VIEWBOX_HORIZONTAL_MARGIN} ${VIEWBOX_VERTICAL_MARGIN} ${SIZE + VIEWBOX_HORIZONTAL_MARGIN * 2} ${SIZE - VIEWBOX_VERTICAL_MARGIN * 2}`}
          className="h-auto w-full"
          role="img"
          aria-label={type === "kapstok" ? effectiveLabels.ariaKapstok : effectiveLabels.ariaGeneral}
          data-wheel-label-count={criterionLabels.length}
          data-wheel-value-count={currentPoints.length}
          onMouseLeave={() => setHoverId(undefined)}
        >
          <circle cx={CENTER} cy={CENTER} r={PLOT_RADIUS} fill="#f8fafc" stroke="#cbd5e1" />

          {/* Background sectors and trend wedges are intentionally below the grid. */}
          {data.criteria.map((item, index) => {
            const start = -90 + index * angleStep;
            const end = start + angleStep;
            const highlighted = activeId === item.id;
            return (
              <g
                key={item.id}
                className="cursor-pointer"
                data-wheel-criterion={item.criterion}
                data-active={activeId === item.id ? "true" : "false"}
              >
                <path
                  d={annularSectorPath(CENTER, CENTER, INNER_RADIUS, PLOT_RADIUS, start, end)}
                  fill={highlighted ? "#dbeafe" : index % 2 ? "#f1f5f9" : "#f8fafc"}
                  stroke="none"
                />
                <path
                  d={annularSectorPath(CENTER, CENTER, INNER_RADIUS, scoreRadius(item.currentScore), start, end)}
                  fill={trendWedgeColor(item.trend)}
                  fillOpacity={item.currentScored ? (highlighted ? "0.4" : trendWedgeOpacity(item.trend)) : "0"}
                  data-wedge-trend={item.trend}
                />
                <path
                  d={annularSectorPath(CENTER, CENTER, INNER_RADIUS, PLOT_RADIUS, start, end)}
                  fill="#ffffff"
                  fillOpacity="0.001"
                  stroke="none"
                  pointerEvents="all"
                  data-wheel-hit={item.criterion}
                  onMouseEnter={() => setHoverId(item.id)}
                  onClick={() => setPinnedId(item.id)}
                />
              </g>
            );
          })}

          {/* Rings and radial separators remain visible over the translucent wedges. */}
          {[20, 40, 60, 80, 100].map((score) => (
            <g key={score}>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={scoreRadius(score)}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={score === 100 ? 1.5 : 1}
              />
              <text
                x={CENTER + 7}
                y={CENTER - scoreRadius(score) + 13}
                fill="#94a3b8"
                fontSize="11"
              >
                {score / 10}
              </text>
            </g>
          ))}
          {data.criteria.map((item, index) => {
            const angle = -90 + index * angleStep;
            const inner = polarPoint(CENTER, CENTER, INNER_RADIUS, angle);
            const outer = polarPoint(CENTER, CENTER, PLOT_RADIUS, angle);
            return (
              <line
                key={`separator-${item.id}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#ffffff"
                strokeWidth="2.5"
                pointerEvents="none"
              />
            );
          })}

          {data.categories.map((category, index) => {
            const start = -90 + category.startIndex * angleStep;
            const end = -90 + category.endIndex * angleStep;
            const label = categoryLabelLayout(category, end - start, type, effectiveNotScoredLabel);
            const labelAngle = Math.abs(end - start) >= 359.99 ? -90 : (start + end) / 2;
            const labelPoint = polarPoint(CENTER, CENTER, (BAND_INNER + BAND_OUTER) / 2, labelAngle);
            return (
              <g
                key={category.name}
                data-wheel-category={category.name}
                data-wheel-category-score={formatPerformancePercentage(category.currentPercentage, effectiveNotScoredLabel)}
                data-wheel-category-trend={category.trend}
                data-wheel-category-start={category.startIndex}
                data-wheel-category-end={category.endIndex}
                data-wheel-category-criteria={data.criteria.slice(category.startIndex, category.endIndex).map((item) => item.id).join(",")}
              >
                <path
                  d={annularSectorPath(CENTER, CENTER, BAND_INNER, BAND_OUTER, start, end)}
                  fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={categoryLabelColor(category.trend)}
                  fontSize={label.fontSize}
                  fontWeight="700"
                  transform={`rotate(${readableRotation(labelAngle + 90)} ${labelPoint.x} ${labelPoint.y})`}
                  textLength={label.textLength}
                  lengthAdjust="spacingAndGlyphs"
                >
                  <title>{`${category.name} - ${label.score}`}</title>
                  {label.text}
                </text>
              </g>
            );
          })}

          {previousCurveSegments.map((segment, index) => segment.length > 1 ? (
            <polyline
              key={`previous-segment-${index}`}
              points={segment.map(pointString).join(" ")}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="7 6"
              strokeLinejoin="round"
              data-wheel-line="previous"
            />
          ) : (
            <circle
              key={`previous-point-${index}`}
              cx={segment[0]?.x}
              cy={segment[0]?.y}
              r="3"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="3 2"
              data-wheel-line="previous"
            />
          ))}
          {data.criteria.every((item) => item.currentScored) && (
            <polygon
              points={currentPoints.map(pointString).join(" ")}
              fill="none"
              stroke="#bfdbfe"
              strokeWidth="2"
              strokeLinejoin="round"
              data-wheel-line="current"
            />
          )}
          {currentPoints.map((point, index) => {
            const next = currentPoints[(index + 1) % currentPoints.length];
            const item = data.criteria[index];
            const nextItem = data.criteria[(index + 1) % data.criteria.length];
            if (!item.currentScored || !nextItem.currentScored) return null;
            return (
              <line
                key={`trend-line-${item.id}`}
                x1={point.x}
                y1={point.y}
                x2={next.x}
                y2={next.y}
                stroke={trendColor(item.trend)}
                strokeWidth="3"
                strokeLinejoin="round"
                data-wheel-trend-line={item.trend}
              />
            );
          })}

          {data.criteria.map((item, index) => {
            const point = currentPoints[index];
            const angle = centerAngle(index, angleStep);
            const labelPoint = polarPoint(CENTER, CENTER, LABEL_RADIUS, angle);
            const rightSide = Math.cos(degreesToRadians(angle)) >= 0;
            const criterionText = item.currentScored && item.currentPercentage !== undefined
              ? `${item.criterion} (${formatPerformancePercentage(item.currentPercentage, effectiveNotScoredLabel)})`
              : item.criterion;
            const maxCharacters = Math.max(10, Math.floor(
              LABEL_RADIUS * degreesToRadians(angleStep) * 0.78 / (9.5 * 0.56)
            ));
            const criterionLines = wrapLabel(criterionText, maxCharacters);
            const color = trendColor(item.trend);
            return (
              <g key={`point-${item.id}`}>
                <line
                  x1={polarPoint(CENTER, CENTER, BAND_OUTER + 3, angle).x}
                  y1={polarPoint(CENTER, CENTER, BAND_OUTER + 3, angle).y}
                  x2={polarPoint(CENTER, CENTER, LABEL_RADIUS - 10, angle).x}
                  y2={polarPoint(CENTER, CENTER, LABEL_RADIUS - 10, angle).y}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />
                {item.currentScored && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={activeId === item.id ? 7 : 5.5}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    data-trend={item.trend}
                  />
                )}
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={rightSide ? "start" : "end"}
                  dominantBaseline="middle"
                  fill={trendColor(item.trend)}
                  fontSize={type === "kapstok" ? "9.5" : "12"}
                  fontWeight={activeId === item.id ? "700" : "600"}
                >
                  {criterionLines.map((line, lineIndex) => (
                    <tspan
                      key={`${item.id}-label-${lineIndex}`}
                      x={labelPoint.x}
                      dy={lineIndex === 0 ? `${-((criterionLines.length - 1) * 11) / 2}px` : "11px"}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 5} fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
          <text x={CENTER} y={CENTER - 6} textAnchor="middle" fill="#003b83" fontSize="22" fontWeight="800">
            {formatPerformancePercentage(totalPercentageOverride ?? data.totalPercentage, effectiveNotScoredLabel)}
          </text>
          <text x={CENTER} y={CENTER + 16} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">
            {effectiveTotalScoreLabel.toUpperCase()}
          </text>
        </svg>
      </div>

      {!compact && <div data-testid="wheel-tooltip" className="mt-2 min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{active.category}</p>
              <p className="mt-1 font-semibold text-slate-900">{active.criterion}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>{effectiveLabels.previous} <strong>{formatPerformancePercentage(active.previousPercentage, effectiveNotScoredLabel)}</strong></span>
              <span>{effectiveLabels.current} <strong>{formatPerformancePercentage(active.currentPercentage, effectiveNotScoredLabel)}</strong></span>
              <TrendBadge trend={active.trend} labels={effectiveLabels} />
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-500">{effectiveLabels.tooltipHelp}</p>
        )}
      </div>}

      {!compact && <WheelLegend hasPrevious={Boolean(data.comparisonInterventionId)} labels={effectiveLabels} />}
    </div>
  );
}

export function WheelTrendBadge({ trend }: { trend: PerformanceTrend }) {
  return <TrendBadge trend={trend} />;
}

function WheelLegend({ hasPrevious, labels }: { hasPrevious: boolean; labels: PerformanceWheelLabels }) {
  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-600">
      <LegendLine color="#003b83" label={labels.currentMeasurement} />
      <LegendLine color="#94a3b8" dashed label={hasPrevious ? labels.previousMeasurement : labels.noPreviousMeasurement} />
      <LegendDot color="#16a34a" label={`${labels.better} = ${labels.green}`} />
      <LegendDot color="#dc2626" label={`${labels.worse} = ${labels.red}`} />
      <LegendDot color="#003b83" label={`${labels.equal} = ${labels.darkBlue}`} />
      <LegendDot color="#1266b3" label={`${labels.first} = ${labels.blue}`} />
    </div>
  );
}

function LegendLine({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="24" height="8" aria-hidden="true">
        <line x1="1" x2="23" y1="4" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>;
}

function TrendBadge({ trend, labels = defaultLabels }: { trend: PerformanceTrend; labels?: PerformanceWheelLabels }) {
  const styles = {
    better: "bg-emerald-100 text-emerald-800",
    worse: "bg-rose-100 text-rose-800",
    equal: "bg-slate-200 text-slate-700",
    first: "bg-blue-100 text-blue-800",
  };
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[trend]}`}>{labels[trend]}</span>;
}

function annularSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  if (Math.abs(endAngle - startAngle) >= 359.99) {
    return [
      annularSectorPath(cx, cy, innerRadius, outerRadius, startAngle, startAngle + 180),
      annularSectorPath(cx, cy, innerRadius, outerRadius, startAngle + 180, startAngle + 360),
    ].join(" ");
  }
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, endAngle);
  const innerEnd = polarPoint(cx, cy, innerRadius, endAngle);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = degreesToRadians(angle);
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

function scoreRadius(score: number) {
  return INNER_RADIUS + (PLOT_RADIUS - INNER_RADIUS) * Math.max(0, Math.min(100, score)) / 100;
}

function centerAngle(index: number, angleStep: number) {
  return -90 + index * angleStep + angleStep / 2;
}

function degreesToRadians(angle: number) {
  return angle * Math.PI / 180;
}

function pointString(point: { x: number; y: number }) {
  return `${point.x},${point.y}`;
}

function curveSegments(points: Array<{ x: number; y: number } | undefined>) {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (point) {
      current.push(point);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

function trendColor(trend: PerformanceTrend) {
  return performanceTrendColor(trend);
}

function categoryLabelColor(trend: PerformanceTrend) {
  return trend === "better" || trend === "worse" ? trendColor(trend) : "#003b83";
}

function trendWedgeColor(trend: PerformanceTrend) {
  if (trend === "better") return "#22c55e";
  if (trend === "worse") return "#ef4444";
  return "#003b83";
}

function trendWedgeOpacity(trend: PerformanceTrend) {
  return trend === "equal" || trend === "first" ? 0.22 : 0.3;
}

function readableRotation(angle: number) {
  const normalized = ((angle % 360) + 360) % 360;
  return normalized > 90 && normalized < 270 ? angle + 180 : angle;
}

function categoryLabelLayout(
  category: { name: string; currentPercentage?: number },
  angleSpan: number,
  type: PerformanceWheelType,
  notScoredLabel: string
) {
  const baseFontSize = type === "kapstok" ? 11 : 13;
  const score = formatPerformancePercentage(category.currentPercentage, notScoredLabel);
  const text = category.currentPercentage === undefined
    ? category.name.toLocaleUpperCase()
    : `${category.name.toLocaleUpperCase()} - ${score}`;
  const radius = (BAND_INNER + BAND_OUTER) / 2;
  const availableWidth = Math.max(24, radius * degreesToRadians(Math.min(360, angleSpan)) * 0.8);
  const estimatedWidth = text.length * baseFontSize * 0.57;
  const fontSize = Math.max(7, Math.min(baseFontSize, baseFontSize * availableWidth / Math.max(1, estimatedWidth)));
  return {
    text,
    fontSize,
    textLength: estimatedWidth > availableWidth ? availableWidth : undefined,
    score,
  };
}

function wrapLabel(label: string, maxCharacters: number) {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [label];
}
