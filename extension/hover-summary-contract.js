
/**
 * YOUTOPIA Hover Summary 전달 계약 v1.
 *
 * 목적:
 * - 검증된 합성 스냅샷 요약과 기존 가상 Preview를 구별한다.
 * - 요청 ID와 응답 대상의 일치를 검사한다.
 * - 외부에서 받은 응답의 구조와 의미를 검증한다.
 *
 * 실제 메시지 전송, API 호출, 인증, UI 변경은 수행하지 않는다.
 * 아직 승인된 운영 API 계약이 아니다.
 */
(function registerHoverSummaryContract(scope) {
  "use strict";

  if (scope.YUTOPIA_HOVER_SUMMARY_CONTRACT) return;

  const VERSION = 1;
  const REQUEST_TYPE = "YUTOPIA_HOVER_SUMMARY_GET_V1";
  const RESPONSE_TYPE = "YUTOPIA_HOVER_SUMMARY_RESULT_V1";

  const REQUEST_FIELDS = [
    "type", "version", "requestId", "targetType", "targetId",
  ];

  const RESPONSE_FIELDS = [
    "type", "version", "requestId",
    "targetType", "targetId", "targetKey", "result",
  ];

  const SUMMARY_FIELDS = [
    "snapshotId", "target", "status", "provenance",
    "observationScope", "observedAt", "analyzedAt",
    "valueSemantics", "sentimentPercent", "topTopics",
  ];

  const STATUSES = new Set([
    "READY", "PARTIAL", "STALE", "NO_DATA",
    "COMMENTS_DISABLED", "ENTITLEMENT_LIMITED",
    "POLICY_BLOCKED", "ERROR",
  ]);

  const DATA_STATUSES = new Set([
    "READY", "PARTIAL", "STALE",
  ]);

  const REJECTION_REASONS = new Set([
    "INVALID_SNAPSHOT", "INVALID_TARGET",
    "TARGET_MISMATCH", "DEMO_SCOPE_ONLY",
    "METRICS_UNAVAILABLE", "INVALID_RESPONSE",
    "SOURCE_ERROR",
  ]);

  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

  const DATE_TIME =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

  function exact(value, fields) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) return false;

    const keys = Object.keys(value);

    return (
      keys.length === fields.length &&
      fields.every(field =>
        Object.prototype.hasOwnProperty.call(value, field)
      )
    );
  }

  function validTarget(type, id) {
    return typeof id === "string" && (
      (type === "VIDEO" && VIDEO_ID.test(id)) ||
      (type === "CHANNEL" && CHANNEL_ID.test(id))
    );
  }

  function validDate(value) {
    return (
      typeof value === "string" &&
      DATE_TIME.test(value) &&
      Number.isFinite(Date.parse(value))
    );
  }

  function nullableDate(value) {
    return value === null || validDate(value);
  }

  function validPercent(value) {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100
    );
  }

  function parseRequest(input) {
    try {
      if (
        !exact(input, REQUEST_FIELDS) ||
        input.type !== REQUEST_TYPE ||
        input.version !== VERSION ||
        !Number.isSafeInteger(input.requestId) ||
        input.requestId < 1 ||
        !validTarget(input.targetType, input.targetId)
      ) return null;

      return Object.freeze({
        type: REQUEST_TYPE,
        version: VERSION,
        requestId: input.requestId,
        targetType: input.targetType,
        targetId: input.targetId,
      });
    } catch {
      return null;
    }
  }

  function makeRequest(targetType, targetId, requestId) {
    return parseRequest({
      type: REQUEST_TYPE,
      version: VERSION,
      requestId,
      targetType,
      targetId,
    });
  }

  /*
   * 기존 TypeScript HoverSummaryProjection의
   * wire-format 소비자 검증기.
   *
   * 이 검사는 서버 인증이나 스냅샷 원본 검증을
   * 대신하지 않는다.
   */
  function parseSummary(input, expected) {
    if (!exact(input, SUMMARY_FIELDS)) return null;

    const target = input.target;
    const provenance = input.provenance;
    const scopeData = input.observationScope;
    const metrics = input.sentimentPercent;
    const topics = input.topTopics;

    if (
      typeof input.snapshotId !== "string" ||
      input.snapshotId.length < 1 ||
      input.snapshotId.length > 128 ||
      input.valueSemantics !== "SNAPSHOT_DERIVED_SYNTHETIC" ||
      !STATUSES.has(input.status)
    ) return null;

    if (
      !exact(target, ["source", "targetType", "targetId"]) ||
      target.source !== "YOUTUBE" ||
      target.targetType !== expected.targetType ||
      target.targetId !== expected.targetId
    ) return null;

    if (
      !exact(provenance, [
        "sourceType", "isSynthetic", "visibility", "tenantId",
      ]) ||
      provenance.sourceType !== "STATIC_FIXTURE" ||
      provenance.isSynthetic !== true ||
      provenance.visibility !== "PUBLIC_REUSABLE" ||
      provenance.tenantId !== null
    ) return null;

    if (
      !exact(scopeData, [
        "mode", "windowStart", "windowEnd", "locale",
      ]) ||
      !["ONE_VIDEO", "SELECTED_CHANNEL_VIDEOS"].includes(
        scopeData.mode
      ) ||
      !validDate(scopeData.windowStart) ||
      !validDate(scopeData.windowEnd) ||
      Date.parse(scopeData.windowStart) >=
        Date.parse(scopeData.windowEnd) ||
      typeof scopeData.locale !== "string" ||
      scopeData.locale.length < 2 ||
      scopeData.locale.length > 16
    ) return null;

    if (
      !nullableDate(input.observedAt) ||
      !nullableDate(input.analyzedAt)
    ) return null;

    if (
      input.observedAt !== null &&
      input.analyzedAt !== null &&
      Date.parse(input.observedAt) >
        Date.parse(input.analyzedAt)
    ) return null;

    if (
      DATA_STATUSES.has(input.status) &&
      (input.observedAt === null || input.analyzedAt === null)
    ) return null;

    let safeMetrics = null;

    if (metrics !== null) {
      if (
        !exact(metrics, [
          "denominator",
          "positivePercent",
          "neutralPercent",
          "negativePercent",
          "classificationCoveragePercent",
        ]) ||
        !Number.isSafeInteger(metrics.denominator) ||
        metrics.denominator < 1 ||
        !validPercent(metrics.positivePercent) ||
        !validPercent(metrics.neutralPercent) ||
        !validPercent(metrics.negativePercent) ||
        (
          metrics.classificationCoveragePercent !== null &&
          !validPercent(metrics.classificationCoveragePercent)
        )
      ) return null;

      const total =
        metrics.positivePercent +
        metrics.neutralPercent +
        metrics.negativePercent;

      if (Math.abs(total - 100) > 0.000001) return null;

      if (
        input.status !== "READY" &&
        input.status !== "PARTIAL"
      ) return null;

      safeMetrics = Object.freeze({
        denominator: metrics.denominator,
        positivePercent: metrics.positivePercent,
        neutralPercent: metrics.neutralPercent,
        negativePercent: metrics.negativePercent,
        classificationCoveragePercent:
          metrics.classificationCoveragePercent,
      });
    }

    if (
      input.status === "READY" &&
      safeMetrics === null
    ) return null;

    if (
      !Array.isArray(topics) ||
      topics.length > 2 ||
      (safeMetrics === null && topics.length > 0)
    ) return null;

    const safeTopics = [];
    const seen = new Set();

    for (const topic of topics) {
      if (
        !exact(topic, ["topicId", "mentionCount"]) ||
        typeof topic.topicId !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,63}$/.test(topic.topicId) ||
        !Number.isSafeInteger(topic.mentionCount) ||
        topic.mentionCount < 0 ||
        seen.has(topic.topicId)
      ) return null;

      seen.add(topic.topicId);

      safeTopics.push(Object.freeze({
        topicId: topic.topicId,
        mentionCount: topic.mentionCount,
      }));
    }

    return Object.freeze({
      snapshotId: input.snapshotId,

      target: Object.freeze({
        source: "YOUTUBE",
        targetType: target.targetType,
        targetId: target.targetId,
      }),

      status: input.status,

      provenance: Object.freeze({
        sourceType: "STATIC_FIXTURE",
        isSynthetic: true,
        visibility: "PUBLIC_REUSABLE",
        tenantId: null,
      }),

      observationScope: Object.freeze({
        mode: scopeData.mode,
        windowStart: scopeData.windowStart,
        windowEnd: scopeData.windowEnd,
        locale: scopeData.locale,
      }),

      observedAt: input.observedAt,
      analyzedAt: input.analyzedAt,

      valueSemantics: "SNAPSHOT_DERIVED_SYNTHETIC",
      sentimentPercent: safeMetrics,
      topTopics: Object.freeze(safeTopics),
    });
  }

  function parseResponse(input, expectedRequest) {
    try {
      const expected = parseRequest(expectedRequest);

      if (
        !expected ||
        !exact(input, RESPONSE_FIELDS) ||
        input.type !== RESPONSE_TYPE ||
        input.version !== VERSION ||
        input.requestId !== expected.requestId ||
        input.targetType !== expected.targetType ||
        input.targetId !== expected.targetId ||
        input.targetKey !==
          expected.targetType + ":" + expected.targetId
      ) return null;

      const result = input.result;
      let safeResult;

      if (result?.kind === "NOT_FOUND") {
        if (!exact(result, ["kind"])) return null;

        safeResult = Object.freeze({
          kind: "NOT_FOUND",
        });
      } else if (result?.kind === "REJECTED") {
        if (
          !exact(result, ["kind", "reason"]) ||
          !REJECTION_REASONS.has(result.reason)
        ) return null;

        safeResult = Object.freeze({
          kind: "REJECTED",
          reason: result.reason,
        });
      } else if (result?.kind === "SNAPSHOT") {
        if (!exact(result, ["kind", "summary"])) return null;

        const summary = parseSummary(
          result.summary,
          expected
        );

        if (!summary) return null;

        safeResult = Object.freeze({
          kind: "SNAPSHOT",
          summary,
        });
      } else {
        return null;
      }

      return Object.freeze({
        type: RESPONSE_TYPE,
        version: VERSION,
        requestId: expected.requestId,
        targetType: expected.targetType,
        targetId: expected.targetId,
        targetKey:
          expected.targetType + ":" + expected.targetId,
        result: safeResult,
      });
    } catch {
      return null;
    }
  }

  /*
   * 향후 Worker 어댑터가 사용할 응답 작성 함수.
   * 입력 데이터가 유효하지 않으면 null을 반환한다.
   */
  function makeResponse(request, result) {
    const expected = parseRequest(request);

    if (!expected) return null;

    return parseResponse({
      type: RESPONSE_TYPE,
      version: VERSION,
      requestId: expected.requestId,
      targetType: expected.targetType,
      targetId: expected.targetId,
      targetKey:
        expected.targetType + ":" + expected.targetId,
      result,
    }, expected);
  }

  scope.YUTOPIA_HOVER_SUMMARY_CONTRACT =
    Object.freeze({
      VERSION,
      REQUEST_TYPE,
      RESPONSE_TYPE,
      makeRequest,
      parseRequest,
      makeResponse,
      parseResponse,
    });
})(globalThis);
