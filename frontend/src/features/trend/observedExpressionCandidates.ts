import { inspectKeyword, userKeyword, type Observation, type TrendWindow } from "./userKeywordTrend";
import { normalizeRelatedExpression } from "./relatedKeywordAnalysis";

/**
 * G2-O: Observed lexical context candidates from the CURRENT, selected comment
 * sample and period. No model, synonym dictionary, remote query, or auto-select.
 */
export const MAX_CONTEXT_CANDIDATES = 8;
export const MAX_CONTEXT_EXAMPLES_PER_TERM = 2;

export type ContextEvidence = Readonly<{
  commentId: string;
  videoId: string;
  videoTitle: string;
  publishedAt: string;
  excerpt: string;
}>;

export type ObservedExpressionCandidate = Readonly<{
  term: string;
  cooccurringComments: number;
  sampleMentions: number;
  evidence: readonly ContextEvidence[];
}>;

export type ObservedExpressionResult =
  | Readonly<{ kind: "INVALID_KEYWORD" | "NO_DATA" }>
  | Readonly<{
      kind: "READY";
      primary: string;
      sampleTotal: number;
      primaryComments: number;
      startDay: string;
      endDay: string;
      candidates: readonly ObservedExpressionCandidate[];
    }>;

const WORD_PATTERN = /[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*/gu;
const DAY_MS = 86400000;

function lexicalTokens(text: string): readonly string[] {
  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  return (normalized.match(WORD_PATTERN) ?? []).filter((word) =>
    Array.from(word).length >= 2 &&
    Array.from(word).length <= 40 &&
    !/^\p{N}+$/u.test(word)
  );
}

/** A candidate is a term observed beside the primary keyword in a comment. */
export function discoverObservedExpressions(
  rawKeyword: string,
  observations: readonly Observation[],
  window: TrendWindow,
): ObservedExpressionResult {
  const primary = userKeyword(rawKeyword);
  if (!primary) return { kind: "INVALID_KEYWORD" };
  const baseline = inspectKeyword(primary, observations, window);
  if (baseline.kind !== "READY") {
    return { kind: baseline.kind === "NO_DATA" ? "NO_DATA" : "INVALID_KEYWORD" };
  }
  const primaryLower = primary.normalize("NFKC").toLocaleLowerCase();
  const primaryParts = new Set(lexicalTokens(primary));
  const start = Date.parse(baseline.startDay + "T00:00:00.000Z");
  const end = Date.parse(baseline.endDay + "T00:00:00.000Z") + DAY_MS;
  const sampled = observations.filter((entry) => {
    const time = Date.parse(entry.publishedAt);
    return Number.isFinite(time) && time >= start && time < end;
  });
  const matching = sampled.filter((entry) =>
    entry.text.normalize("NFKC").toLocaleLowerCase().includes(primaryLower));
  const seen = new Map<string, { count: number; evidence: ContextEvidence[] }>();
  for (const record of matching) {
    // A word in a single comment counts once, regardless of repetitions.
    const words = new Set(lexicalTokens(record.text));
    for (const term of words) {
      if (primaryParts.has(term) || term.includes(primaryLower) ||
          primaryLower.includes(term) || !normalizeRelatedExpression(term)) continue;
      const prior = seen.get(term) ?? { count: 0, evidence: [] };
      prior.count++;
      if (prior.evidence.length < MAX_CONTEXT_EXAMPLES_PER_TERM) {
        prior.evidence.push({
          commentId: record.id,
          videoId: record.videoId,
          videoTitle: record.videoTitle,
          publishedAt: record.publishedAt,
          excerpt: Array.from(record.text).slice(0, 160).join(""),
        });
      }
      seen.set(term, prior);
    }
  }
  const candidates: ObservedExpressionCandidate[] = [...seen]
    .map(([term, record]) => ({
      term,
      cooccurringComments: record.count,
      sampleMentions: sampled.filter((entry) =>
        entry.text.normalize("NFKC").toLocaleLowerCase().includes(term)).length,
      evidence: record.evidence,
    }))
    .sort((a, b) =>
      b.cooccurringComments - a.cooccurringComments ||
      b.sampleMentions - a.sampleMentions ||
      a.term.localeCompare(b.term))
    .slice(0, MAX_CONTEXT_CANDIDATES);

  return {
    kind: "READY",
    primary,
    sampleTotal: baseline.total,
    primaryComments: matching.length,
    startDay: baseline.startDay,
    endDay: baseline.endDay,
    candidates,
  };
}
