"use client";

import { useMemo, useState } from "react";
import {
  getPerformanceWheelData,
  type PerformanceTrend,
  type PerformanceWheelType,
} from "@/lib/performance/performance-wheel";
import type { HistoricalCoaching } from "@/lib/performance-data";

const SIZE = 1000;
const CENTER = SIZE / 2;
const INNER_RADIUS = 54;
const PLOT_RADIUS = 286;
const BAND_INNER = 300;
const BAND_OUTER = 336;
const LABEL_RADIUS = 372;
const CATEGORY_COLORS = ["#dcecff", "#e8eff8", "#d9e7f7", "#e5edf7", "#d7e8f2"];

export function PerformanceWheel({
  representativeId,
  currentInterventionId,
  comparisonInterventionId,
  type,
  coachings,
}: {
  representativeId: string;
  currentInterventionId: string;
  comparisonInterventionId?: string;
  type: PerformanceWheelType;
  coachings: HistoricalCoaching[];
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

  if (!data) {
    return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Geen vergelijkbare scores beschikbaar.</div>;
  }

  const count = data.criteria.length;
  if (count === 0) {
    return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Geen gescoorde criteria beschikbaar.</div>;
  }
  const angleStep = 360 / count;
  const currentPoints = data.criteria.map((item, index) =>
    polarPoint(CENTER, CENTER, scoreRadius(item.currentScore), centerAngle(index, angleStep))
  );
  const previousPoints = data.criteria.flatMap((item, index) =>
    item.previousScore === undefined
      ? []
      : [polarPoint(CENTER, CENTER, scoreRadius(item.previousScore), centerAngle(index, angleStep))]
  );
  const labels = data.criteria.map((item) => item.criterion);
  if (labels.length !== currentPoints.length) {
    console.error("[performance-wheel] Het aantal labels en scorewaarden komt niet overeen.", {
      labels: labels.length,
      values: currentPoints.length,
      interventionId: data.currentInterventionId,
    });
    return <div className="rounded-2xl bg-rose-50 p-8 text-center text-sm text-rose-700">De prestatiecirkel kon niet volledig worden opgebouwd.</div>;
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-[1040px]">
        <svg
          data-testid="performance-wheel-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${type === "kapstok" ? "Kapstok" : "Algemeen"} competentiewiel`}
          data-wheel-label-count={labels.length}
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
                  fillOpacity={highlighted ? "0.4" : trendWedgeOpacity(item.trend)}
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
            const labelPoint = polarPoint(CENTER, CENTER, (BAND_INNER + BAND_OUTER) / 2, (start + end) / 2);
            return (
              <g key={category.name}>
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
                  fill="#003b83"
                  fontSize={type === "kapstok" ? "12" : "14"}
                  fontWeight="700"
                  transform={`rotate(${readableRotation((start + end) / 2)} ${labelPoint.x} ${labelPoint.y})`}
                >
                  {category.name}
                </text>
              </g>
            );
          })}

          {previousPoints.length === count && (
            <polyline
              points={previousPoints.map(pointString).join(" ")}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="7 6"
              strokeLinejoin="round"
              data-wheel-line="previous"
            />
          )}
          <polygon
            points={currentPoints.map(pointString).join(" ")}
            fill="none"
            stroke="#bfdbfe"
            strokeWidth="2"
            strokeLinejoin="round"
            data-wheel-line="current"
          />
          {currentPoints.map((point, index) => {
            const next = currentPoints[(index + 1) % currentPoints.length];
            const item = data.criteria[index];
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
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={activeId === item.id ? 7 : 5.5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  data-trend={item.trend}
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={rightSide ? "start" : "end"}
                  dominantBaseline="middle"
                  fill={trendColor(item.trend)}
                  fontSize={type === "kapstok" ? "9.5" : "12"}
                  fontWeight={activeId === item.id ? "700" : "600"}
                >
                  {compactLabel(item.criterion, type === "kapstok" ? 25 : 28)} ({item.currentScored ? formatScore(item.currentTen) : "niet gescoord"})
                </text>
              </g>
            );
          })}

          <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 5} fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
          <text x={CENTER} y={CENTER - 6} textAnchor="middle" fill="#003b83" fontSize="22" fontWeight="800">
            {formatScore(average(data.criteria.map((item) => item.currentTen)))}
          </text>
          <text x={CENTER} y={CENTER + 16} textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="600">
            GEMIDDELD
          </text>
        </svg>
      </div>

      <div data-testid="wheel-tooltip" className="mt-2 min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{active.category}</p>
              <p className="mt-1 font-semibold text-slate-900">{active.criterion}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>Vorige <strong>{active.previousTen === undefined ? "-" : formatScore(active.previousTen)}</strong></span>
              <span>Huidige <strong>{active.currentScored ? formatScore(active.currentTen) : "niet gescoord"}</strong></span>
              <TrendBadge trend={active.trend} />
            </div>
          </div>
        ) : (
          <p className="text-center text-slate-500">Beweeg over of tik op een criterium voor scoredetails.</p>
        )}
      </div>

      <WheelLegend hasPrevious={Boolean(data.comparisonInterventionId)} />
    </div>
  );
}

export function WheelTrendBadge({ trend }: { trend: PerformanceTrend }) {
  return <TrendBadge trend={trend} />;
}

function WheelLegend({ hasPrevious }: { hasPrevious: boolean }) {
  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-600">
      <LegendLine color="#003b83" label="Huidige meting" />
      <LegendLine color="#94a3b8" dashed label={hasPrevious ? "Vorige meting" : "Geen vorige meting"} />
      <LegendDot color="#16a34a" label="Groen = beter" />
      <LegendDot color="#dc2626" label="Rood = slechter" />
      <LegendDot color="#003b83" label="Donkerblauw = gelijk" />
      <LegendDot color="#1266b3" label="Blauw = eerste meting" />
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

function TrendBadge({ trend }: { trend: PerformanceTrend }) {
  const styles = {
    better: "bg-emerald-100 text-emerald-800",
    worse: "bg-rose-100 text-rose-800",
    equal: "bg-slate-200 text-slate-700",
    first: "bg-blue-100 text-blue-800",
  };
  const labels = { better: "Beter", worse: "Slechter", equal: "Gelijk", first: "Eerste meting" };
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[trend]}`}>{labels[trend]}</span>;
}

function annularSectorPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
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

function trendColor(trend: PerformanceTrend) {
  if (trend === "better") return "#16a34a";
  if (trend === "worse") return "#dc2626";
  if (trend === "equal") return "#003b83";
  return "#1266b3";
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

function compactLabel(label: string, limit: number) {
  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
}

function formatScore(value: number) {
  return value.toLocaleString("nl-BE", { maximumFractionDigits: 1 });
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
