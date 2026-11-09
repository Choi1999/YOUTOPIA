import {
  inspectKeyword,
  userKeyword,
  type Observation,
  type TrendWindow,
} from "./userKeywordTrend";

/**
 * G2-N manual-only expression expansion. It is literal substring matching,
 * not semantic inference, automatic synonym retrieval, or a new API query.
 */
export const MAX_RELATED_EXPRESSIONS = 5;
export const MAX_RELATED_EXPRESSION_CHARS = 40;

/**
 * Optional editorial *examples*, never selected automatically. Unknown
 * primary user queries remain fully supported via manual entry.
 */
const EXAMPLE_TERMS: Readonly<Record<string, readonly string[]>> = {
  음악: ["노래", "플레이리스트", "음원"],
};

export function expressionExamples(rawKeyword: string): readonly string[] {
  const keyword = userKeyword(rawKeyword);
  return keyword ? (EXAMPLE_TERMS[keyword] ?? []) : [];
}

export function normalizeRelatedExpression(raw: string): string | null {
  const term = userKeyword(raw);
  return term && Array.from(term).length <= MAX_RELATED_EXPRESSION_CHARS
    ? term : null;
}

export type SelectionResult =
  | Readonly<{ kind: "READY"; terms: readonly string[] }>
  | Readonly<{ kind: "INVALID"; message: string }>;

export function addRelatedExpression(
  primary: string,
  selected: readonly string[],
  draft: string,
): SelectionResult {
  const primaryTerm = userKeyword(primary);
  const term = normalizeRelatedExpression(draft);
  if (!primaryTerm || !term) return {
    kind: "INVALID", message: "관련 표현은 1~40자로 직접 입력하세요.",
  };
  const normalized = selected.map(normalizeRelatedExpression);
  if (normalized.some((value) => value === null)) return {
    kind: "INVALID", message: "선택한 관련 표현이 올바르지 않습니다.",
  };
  const key = (value: string) => value.normalize("NFKC").toLocaleLowerCase();
  const existing = normalized as string[];
  if (key(term) === key(primaryTerm)) return {
    kind: "INVALID", message: "원래 키워드와 동일한 표현은 추가할 수 없습니다.",
  };
  if (existing.some((value) => key(value) === key(term))) return {
    kind: "INVALID", message: "이미 선택한 관련 표현입니다.",
  };
  if (existing.length >= MAX_RELATED_EXPRESSIONS) return {
    kind: "INVALID", message: "관련 표현은 최대 5개까지 선택할 수 있습니다.",
  };
  return { kind: "READY", terms: [...existing, term] };
}

export type ExpandedEvidence = Readonly<{
  record: Observation;
  matchType: "PRIMARY" | "RELATED_ONLY";
  matchedRelatedTerms: readonly string[];
}>;

export type ExpandedGroup = Readonly<{
  id: string;
  label: string;
  observed: number;
  primary: number;
  relatedOnly: number;
  combined: number;
}>;

export type ExpandedKeywordResult =
  | Readonly<{ kind: "NO_DATA" | "INVALID" }>
  | Readonly<{
      kind: "READY";
      primaryTerm: string;
      selectedTerms: readonly string[];
      windowStart: string;
      windowEnd: string;
      total: number;
      primaryCount: number;
      relatedOnlyCount: number;
      combinedCount: number;
      daily: readonly Readonly<{
        day: string;
        observed: number;
        primary: number;
        relatedOnly: number;
        combined: number;
      }>[];
      terms: readonly Readonly<{ term: string; matched: number }>[];
      videos: readonly ExpandedGroup[];
      channels: readonly ExpandedGroup[];
      evidence: readonly ExpandedEvidence[];
    }>;

export function analyzeExpandedKeyword(
  rawKeyword: string,
  observations: readonly Observation[],
  period: TrendWindow,
  selectedRelated: readonly string[],
): ExpandedKeywordResult {
  const baseline = inspectKeyword(rawKeyword, observations, period);
  // TrendResult has a shared NO_DATA | INVALID_KEYWORD variant; narrow to
  // READY explicitly before accessing the baseline's data-bearing properties.
  if (baseline.kind !== "READY") {
    return { kind: baseline.kind === "NO_DATA" ? "NO_DATA" : "INVALID" };
  }
  if (selectedRelated.length > MAX_RELATED_EXPRESSIONS) return { kind: "INVALID" };
  const related: string[] = [];
  for (const raw of selectedRelated) {
    const term = normalizeRelatedExpression(raw);
    if (!term) return { kind: "INVALID" };
    const lowered = term.toLocaleLowerCase();
    if (lowered === baseline.keyword.toLocaleLowerCase() ||
        related.some((value) => value.toLocaleLowerCase() === lowered)) {
      return { kind: "INVALID" };
    }
    related.push(term);
  }

  const lower = (value: string) => value.normalize("NFKC").toLocaleLowerCase();
  const key = lower(baseline.keyword);
  const candidates = related.map(lower);
  const start = Date.parse(baseline.startDay + "T00:00:00.000Z");
  const end = Date.parse(baseline.endDay + "T00:00:00.000Z") + 86400000;
  const inWindow = observations.filter((item) => {
    const time = Date.parse(item.publishedAt);
    return Number.isFinite(time) && time >= start && time < end;
  });
  const seen = inWindow.map((record) => {
    const text = lower(record.text);
    const primary = text.includes(key);
    const foundTerms = related.filter((_, index) => text.includes(candidates[index]));
    return {
      record,
      primary,
      relatedOnly: !primary && foundTerms.length > 0,
      foundTerms,
    };
  });
  const primaryCount = seen.filter((item) => item.primary).length;
  const relatedOnlyCount = seen.filter((item) => item.relatedOnly).length;

  const grouped = (field: "videoId" | "channelId",
    title: "videoTitle" | "channelName"): readonly ExpandedGroup[] => {
    const byId = new Map<string, ExpandedGroup>();
    for (const item of seen) {
      const id = item.record[field];
      const current = byId.get(id) ?? {
        id, label: item.record[title], observed: 0,
        primary: 0, relatedOnly: 0, combined: 0,
      };
      const primary = current.primary + Number(item.primary);
      const relatedOnly = current.relatedOnly + Number(item.relatedOnly);
      byId.set(id, {
        ...current, observed: current.observed + 1, primary, relatedOnly,
        combined: primary + relatedOnly,
      });
    }
    return [...byId.values()].filter((item) => item.combined > 0)
      .sort((a, b) => b.combined - a.combined || a.label.localeCompare(b.label))
      .slice(0, 8);
  };

  const daily = baseline.days.map(({ day, observed }) => {
    const sameDay = seen.filter(({ record }) =>
      new Date(record.publishedAt).toISOString().slice(0, 10) === day);
    const primary = sameDay.filter((item) => item.primary).length;
    const relatedOnly = sameDay.filter((item) => item.relatedOnly).length;
    return { day, observed, primary, relatedOnly, combined: primary + relatedOnly };
  });
  const evidence: ExpandedEvidence[] = seen
    .filter((item) => item.primary || item.relatedOnly)
    .map((item) => ({
      record: item.record,
      matchType: item.primary ? "PRIMARY" as const : "RELATED_ONLY" as const,
      matchedRelatedTerms: item.foundTerms,
    }))
    .sort((a, b) =>
      b.record.publishedAt.localeCompare(a.record.publishedAt) ||
      a.record.id.localeCompare(b.record.id))
    .slice(0, 20);
  return {
    kind: "READY",
    primaryTerm: baseline.keyword,
    selectedTerms: related,
    windowStart: baseline.startDay,
    windowEnd: baseline.endDay,
    total: baseline.total,
    primaryCount,
    relatedOnlyCount,
    combinedCount: primaryCount + relatedOnlyCount,
    daily,
    terms: related.map((term) => ({
      term, matched: seen.filter((item) => item.foundTerms.includes(term)).length,
    })),
    videos: grouped("videoId", "videoTitle"),
    channels: grouped("channelId", "channelName"),
    evidence,
  };
}
