import { compareVideoProjections, type VideoComparisonResult } from "./videoComparison";

const COLUMNS = [
  "record_type", "metric", "video_a", "video_b", "delta_b_minus_a",
  "unit", "source",
] as const;

const SOURCE = "STATIC_FIXTURE_SYNTHETIC_DEMO";
const MAX_CSV_CHARS = 100_000;

/**
 * Neutralize CSV/Excel formula-looking untrusted text. Generated numeric
 * signed differences remain numeric so users can compute with the CSV.
 */
function csvCell(value: string | number): string {
  const raw = String(value);
  const isNumeric = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw);
  const safe = !isNumeric &&
    (/^\s*[=+@-]/.test(raw) || /^[\u0000-\u001f\u007f]/.test(raw))
      ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function row(...cells: Array<string | number>): string {
  if (cells.length !== COLUMNS.length) throw new Error("INVALID_CSV_ROW");
  return cells.map(csvCell).join(",");
}

function number(value: number): string {
  return value.toFixed(1);
}

/**
 * YU-43: export only an already validated synthetic two-video comparison.
 * No comments, no raw provider responses, no future/unknown metrics.
 * A forged READY result is revalidated with the existing comparison contract.
 */
export function serializeSyntheticComparisonCsv(
  comparison: VideoComparisonResult,
): string | null {
  if (comparison.kind !== "READY") return null;
  const verified = compareVideoProjections(comparison.left, comparison.right);
  if (verified.kind !== "READY") return null;

  const left = verified.left;
  const right = verified.right;
  const a = left.sentimentPercent;
  const b = right.sentimentPercent;
  if (!a || !b) return null;

  const rows: string[] = [];
  rows.push(COLUMNS.map(csvCell).join(","));
  rows.push(row("notice", "data_usage", "SYNTHETIC_DEMO_NOT_REAL_YOUTUBE_ANALYSIS",
    "SYNTHETIC_DEMO_NOT_REAL_YOUTUBE_ANALYSIS", "", "label", SOURCE));
  rows.push(row("metadata", "video_id", left.target.targetId, right.target.targetId,
    "", "video_identifier", SOURCE));
  rows.push(row("metadata", "snapshot_id", left.snapshotId, right.snapshotId,
    "", "synthetic_snapshot_id", SOURCE));
  rows.push(row("metadata", "observation_start", left.observationScope.windowStart,
    right.observationScope.windowStart, "", "ISO8601", SOURCE));
  rows.push(row("metadata", "observation_end", left.observationScope.windowEnd,
    right.observationScope.windowEnd, "", "ISO8601", SOURCE));
  rows.push(row("metadata", "analyzed_at", left.analyzedAt ?? "",
    right.analyzedAt ?? "", "", "ISO8601", SOURCE));
  rows.push(row("metadata", "analysis_version", left.analysisVersion ?? "",
    right.analysisVersion ?? "", "", "version", SOURCE));
  rows.push(row("metadata", "classified_denominator", a.denominator,
    b.denominator, "", "classified_comments", SOURCE));

  const categories = [
    ["positive_percent", a.positivePercent, b.positivePercent],
    ["neutral_percent", a.neutralPercent, b.neutralPercent],
    ["negative_percent", a.negativePercent, b.negativePercent],
  ] as const;
  for (const [metric, leftPct, rightPct] of categories) {
    rows.push(row("sentiment", metric, number(leftPct), number(rightPct),
      number(rightPct - leftPct), "percentage_points", SOURCE));
  }
  for (const topic of verified.topics) {
    rows.push(row("topic_mentions", topic.topicId, topic.leftCount,
      topic.rightCount, topic.rightCount - topic.leftCount, "mentions", SOURCE));
  }
  const output = rows.join("\r\n") + "\r\n";
  return output.length <= MAX_CSV_CHARS ? output : null;
}

export const SYNTHETIC_COMPARISON_CSV_FILENAME =
  "youtopia-synthetic-video-comparison.csv";
