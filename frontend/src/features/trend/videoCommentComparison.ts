import { userKeyword } from "./userKeywordTrend";
import type { CollectedCommentSample } from "./youtubeCommentClient";

export type VideoCommentComparison = Readonly<{
  videoId: string;
  videoTitle: string;
  fetchedAt: string;
  sampledTotal: number;
  periodTotal: number;
  keywordMatches: number;
  matchPercent: number | null;
  hasMore: boolean;
  skipped: number;
  truncated: number;
}>;

/** Compare proportions within explicitly collected FIRST PAGE samples only. */
export function compareVideoCommentSamples(
  rawKeyword: string,
  samples: readonly CollectedCommentSample[],
  startDay: string,
  endDay: string,
): readonly VideoCommentComparison[] {
  const term = userKeyword(rawKeyword);
  const start = Date.parse(startDay + "T00:00:00.000Z");
  const end = Date.parse(endDay + "T00:00:00.000Z");
  if (!term || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const needle = term.toLocaleLowerCase();
  return samples.map((sample) => {
    const visible = sample.comments.filter((comment) => {
      const time = Date.parse(comment.publishedAt);
      return Number.isFinite(time) && time >= start && time < end + 86400000;
    });
    const count = visible.filter((comment) =>
      comment.text.normalize("NFKC").toLocaleLowerCase().includes(needle)).length;
    return {
      videoId: sample.videoId,
      videoTitle: sample.videoTitle,
      fetchedAt: sample.fetchedAt,
      sampledTotal: sample.sampledCount,
      periodTotal: visible.length,
      keywordMatches: count,
      matchPercent: visible.length ? Number((count / visible.length * 100).toFixed(1)) : null,
      hasMore: sample.hasMore,
      skipped: sample.skipped,
      truncated: sample.truncated,
    };
  });
}
