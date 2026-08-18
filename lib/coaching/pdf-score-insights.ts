export type PdfScoreInsight = {
  criterion: string;
  score: number;
};

export function rankUniqueScoreInsights(
  rows: Array<{ criterion: string; score: number; scored?: boolean }>,
  limit = 3,
) {
  const grouped = new Map<string, { criterion: string; scores: number[] }>();
  for (const row of rows) {
    if (row.scored === false || !Number.isFinite(row.score)) continue;
    const criterion = row.criterion.trim();
    if (!criterion) continue;
    const key = criterion.replace(/\s+/g, " ").toLocaleLowerCase("nl-BE");
    const existing = grouped.get(key) ?? { criterion, scores: [] };
    existing.scores.push(row.score);
    grouped.set(key, existing);
  }
  const unique = [...grouped.values()].map((item) => ({
    criterion: item.criterion,
    score: item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length,
  }));
  const descending = [...unique].sort(compareDescending);
  if (descending.length === 0) return { strongest: [], improvements: [] };
  if (descending.length === 1) return { strongest: descending, improvements: [] };
  if (descending[0].score === descending.at(-1)?.score) {
    return { strongest: descending.slice(0, limit), improvements: [] };
  }

  const strongestCount = Math.min(limit, Math.ceil(descending.length / 2));
  const strongest = descending.slice(0, strongestCount);
  const strongestKeys = new Set(strongest.map((row) => insightKey(row.criterion)));
  const improvements = [...descending]
    .sort(compareAscending)
    .filter((row) => !strongestKeys.has(insightKey(row.criterion)))
    .slice(0, limit);
  return { strongest, improvements };
}

function insightKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("nl-BE");
}

function compareDescending(left: PdfScoreInsight, right: PdfScoreInsight) {
  return right.score - left.score || left.criterion.localeCompare(right.criterion, "nl-BE");
}

function compareAscending(left: PdfScoreInsight, right: PdfScoreInsight) {
  return left.score - right.score || left.criterion.localeCompare(right.criterion, "nl-BE");
}
