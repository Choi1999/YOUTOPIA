
import type { AnalysisSnapshot } from "./analysisSnapshot";

type ValidationReason =
  | "STRUCTURE"
  | "VERSION"
  | "TARGET"
  | "SCOPE"
  | "PROVENANCE"
  | "TIMESTAMP"
  | "SAMPLE"
  | "SENTIMENT"
  | "TOPICS"
  | "COUNTS"
  | "STATE";

export type SnapshotValidationResult =
  | { kind: "VALID"; snapshot: AnalysisSnapshot }
  | { kind: "INVALID"; reason: ValidationReason };

const FIELDS = {
  snapshot: [
    "contractVersion", "snapshotId", "target", "scope",
    "status", "sourceType", "isSynthetic", "visibility",
    "tenantId", "observedAt", "analyzedAt", "sample",
    "sentiment", "topics", "analysisVersion",
    "topicTaxonomyVersion",
  ],
  target: ["source", "targetType", "targetId"],
  scope: ["mode", "windowStart", "windowEnd", "locale"],
  sample: [
    "rawCount", "eligibleCount", "excludedCount",
    "classifiedCount", "unclassifiedCount",
  ],
  sentiment: ["positive", "neutral", "negative"],
  topic: [
    "topicId", "mentionCount",
    "classifiedTopicCount", "negativeTopicCount",
  ],
} as const;

const STATUSES = [
  "READY", "PARTIAL", "STALE", "NO_DATA",
  "COMMENTS_DISABLED", "ENTITLEMENT_LIMITED",
  "POLICY_BLOCKED", "ERROR",
];

const DATA_STATUSES = ["READY", "PARTIAL", "STALE"];

const DATE_TIME_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;

function invalid(reason: ValidationReason): SnapshotValidationResult {
  return { kind: "INVALID", reason };
}

/** 필수 필드만 존재하고 추가 필드가 없는 객체인지 확인한다. */
function exactRecord(
  value: unknown,
  fields: readonly string[],
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const keys = Object.keys(value);

  return (
    keys.length === fields.length &&
    fields.every((field) =>
      Object.prototype.hasOwnProperty.call(value, field)
    )
  );
}

function oneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function nullableCount(value: unknown): value is number | null {
  return value === null || nonNegativeInteger(value);
}

function nullableVersion(value: unknown): boolean {
  return value === null ||
    (typeof value === "string" && value.length > 0);
}

/**
 * 이 프로젝트에서 사용하는 RFC 3339 날짜·시각 형식을 확인한다.
 * 전체 JSON Schema format 검증기를 대체하지는 않는다.
 */
function dateTime(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !DATE_TIME_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);

  return (
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day
  );
}

function nullableDateTime(value: unknown): value is string | null {
  return value === null || dateTime(value);
}

type Sample = NonNullable<AnalysisSnapshot["sample"]>;
type Sentiment = NonNullable<AnalysisSnapshot["sentiment"]>;
type Topic = AnalysisSnapshot["topics"][number];

function isSample(value: unknown): value is Sample {
  return (
    exactRecord(value, FIELDS.sample) &&
    FIELDS.sample.every((field) => nullableCount(value[field]))
  );
}

function isSentiment(value: unknown): value is Sentiment {
  return (
    exactRecord(value, FIELDS.sentiment) &&
    FIELDS.sentiment.every((field) =>
      nonNegativeInteger(value[field])
    )
  );
}

function isTopic(value: unknown): value is Topic {
  if (!exactRecord(value, FIELDS.topic)) return false;

  return (
    typeof value.topicId === "string" &&
    /^[A-Z][A-Z0-9_]{1,63}$/.test(value.topicId) &&
    nonNegativeInteger(value.mentionCount) &&
    nonNegativeInteger(value.classifiedTopicCount) &&
    nonNegativeInteger(value.negativeTopicCount) &&
    value.mentionCount >= value.classifiedTopicCount &&
    value.classifiedTopicCount >= value.negativeTopicCount
  );
}

/**
 * analysis-v1 후보 계약에 맞춘 프론트엔드 런타임 검증.
 *
 * 서버 인증·권한 검사 또는 전체 JSON Schema 검증은 담당하지 않는다.
 */
export function validateAnalysisSnapshot(
  input: unknown,
): SnapshotValidationResult {
  if (!exactRecord(input, FIELDS.snapshot)) {
    return invalid("STRUCTURE");
  }

  if (
    input.contractVersion !== "analysis-v1-candidate" ||
    typeof input.snapshotId !== "string" ||
    input.snapshotId.length < 1 ||
    input.snapshotId.length > 128
  ) {
    return invalid("VERSION");
  }

  const target = input.target;

  if (
    !exactRecord(target, FIELDS.target) ||
    target.source !== "YOUTUBE" ||
    !(
      (target.targetType === "VIDEO" &&
        typeof target.targetId === "string" &&
        /^[A-Za-z0-9_-]{11}$/.test(target.targetId)) ||
      (target.targetType === "CHANNEL" &&
        typeof target.targetId === "string" &&
        /^UC[A-Za-z0-9_-]{22}$/.test(target.targetId))
    )
  ) {
    return invalid("TARGET");
  }

  const scope = input.scope;

  if (
    !exactRecord(scope, FIELDS.scope) ||
    !oneOf(scope.mode, [
      "ONE_VIDEO", "SELECTED_CHANNEL_VIDEOS",
    ]) ||
    !dateTime(scope.windowStart) ||
    !dateTime(scope.windowEnd) ||
    Date.parse(scope.windowStart) >= Date.parse(scope.windowEnd) ||
    typeof scope.locale !== "string" ||
    scope.locale.length < 2 ||
    scope.locale.length > 16
  ) {
    return invalid("SCOPE");
  }

  if (!oneOf(input.status, STATUSES)) {
    return invalid("STATE");
  }

  if (
    !oneOf(input.sourceType, [
      "STATIC_FIXTURE", "APPROVED_PROVIDER",
    ]) ||
    typeof input.isSynthetic !== "boolean" ||
    input.isSynthetic !== (input.sourceType === "STATIC_FIXTURE") ||
    !oneOf(input.visibility, [
      "PUBLIC_REUSABLE", "TENANT_PRIVATE",
    ]) ||
    (
      input.visibility === "PUBLIC_REUSABLE" &&
      input.tenantId !== null
    ) ||
    (
      input.visibility === "TENANT_PRIVATE" &&
      (
        typeof input.tenantId !== "string" ||
        input.tenantId.trim().length === 0
      )
    )
  ) {
    return invalid("PROVENANCE");
  }

  if (
    !nullableDateTime(input.observedAt) ||
    !nullableDateTime(input.analyzedAt) ||
    (
      input.observedAt !== null &&
      input.analyzedAt !== null &&
      Date.parse(input.observedAt) > Date.parse(input.analyzedAt)
    ) ||
    !nullableVersion(input.analysisVersion) ||
    !nullableVersion(input.topicTaxonomyVersion)
  ) {
    return invalid("TIMESTAMP");
  }

  const sample = input.sample;
  const sentiment = input.sentiment;

  if (sample !== null && !isSample(sample)) {
    return invalid("SAMPLE");
  }

  if (sentiment !== null && !isSentiment(sentiment)) {
    return invalid("SENTIMENT");
  }

  if (
    !Array.isArray(input.topics) ||
    input.topics.length > 100
  ) {
    return invalid("TOPICS");
  }

  for (const topic of input.topics) {
    if (!isTopic(topic)) {
      return invalid("TOPICS");
    }

    if (
      sample !== null &&
      sample.eligibleCount !== null &&
      topic.mentionCount > sample.eligibleCount
    ) {
      return invalid("TOPICS");
    }
  }

  const hasData = oneOf(input.status, DATA_STATUSES);

  if (!hasData) {
    if (
      sample !== null ||
      sentiment !== null ||
      input.topics.length !== 0 ||
      input.analyzedAt !== null
    ) {
      return invalid("STATE");
    }
  } else {
    if (
      sample === null ||
      sentiment === null ||
      input.observedAt === null ||
      input.analyzedAt === null
    ) {
      return invalid("STATE");
    }

    const {
      rawCount,
      eligibleCount,
      excludedCount,
      classifiedCount,
      unclassifiedCount,
    } = sample;

    if (
      (
        rawCount !== null &&
        eligibleCount !== null &&
        excludedCount !== null &&
        rawCount !== eligibleCount + excludedCount
      ) ||
      (
        eligibleCount !== null &&
        classifiedCount !== null &&
        unclassifiedCount !== null &&
        eligibleCount !== classifiedCount + unclassifiedCount
      ) ||
      (
        eligibleCount !== null &&
        classifiedCount !== null &&
        classifiedCount > eligibleCount
      ) ||
      (
        rawCount !== null &&
        eligibleCount !== null &&
        eligibleCount > rawCount
      ) ||
      (
        rawCount !== null &&
        excludedCount !== null &&
        excludedCount > rawCount
      ) ||
      (
        eligibleCount !== null &&
        unclassifiedCount !== null &&
        unclassifiedCount > eligibleCount
      )
    ) {
      return invalid("COUNTS");
    }

    const total =
      sentiment.positive + sentiment.neutral + sentiment.negative;

    if (
      !Number.isSafeInteger(total) ||
      (
        classifiedCount !== null &&
        total !== classifiedCount
      ) ||
      (
        input.status === "READY" &&
        (classifiedCount === null || classifiedCount === 0)
      )
    ) {
      return invalid("COUNTS");
    }
  }

  // 위 필드 및 의미 검사를 통과한 경우에만 타입을 확정한다.
  return {
    kind: "VALID",
    snapshot: input as unknown as AnalysisSnapshot,
  };
}
