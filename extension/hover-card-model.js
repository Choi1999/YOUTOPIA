/*
 * YUTOPIA Hover Card Mock Model — 작업 26
 *
 * 목적: 실제 YouTube 댓글/통계/제목이 아닌 고정된 합성 데이터로 UI 모양만 검증.
 * 입력: 23/24번에서 식별된 안정 VIDEO/CHANNEL target.
 * 출력: isSynthetic=true, STATIC_FIXTURE source, 명확한 가상 표본/분포/범위.
 * 실패: targetType 또는 targetId가 불확실하면 null, 데이터나 퍼센트를 만들지 않는다.
 * 주의: seed를 targetId로 정하지만 이것은 실제 영상과 관련된 분석이 아니다.
 */
(function registerYutopiaHoverCardModel(scope) {
  "use strict";
  if (scope.YUTOPIA_HOVER_CARD_MODEL) return;

  const VIDEO_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const CHANNEL_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
  const EXAMPLES = Object.freeze([
    Object.freeze({positive:45, neutral:35, negative:20, sample:120}),
    Object.freeze({positive:38, neutral:39, negative:23, sample:90}),
    Object.freeze({positive:52, neutral:28, negative:20, sample:150}),
  ]);

  function mockForTarget(target) {
    if (!target || typeof target !== "object") return null;
    const {targetType, targetId} = target;
    if (
      (targetType !== "VIDEO" && targetType !== "CHANNEL") ||
      typeof targetId !== "string" ||
      !(targetType === "VIDEO" ? VIDEO_PATTERN : CHANNEL_PATTERN).test(targetId)
    ) return null;

    let index = 0;
    for (const char of targetId) index = (index * 31 + char.charCodeAt(0)) % EXAMPLES.length;
    const sample = EXAMPLES[index];

    /*
     * Preview와 Web 분석의 공통 식별·출처 의미를 정의한다.
     *
     * 가상 시각화 비율은 AnalysisSnapshot의 감성 집계가 아니다.
     * 실제 분석하지 않았으므로 분모·기간·스냅샷 ID는 null이다.
     */
    const previewContract = Object.freeze({
      contractVersion: "preview-web-compat-v1-draft",

      target: Object.freeze({
        source: "YOUTUBE",
        targetType,
        targetId,
      }),

      provenance: Object.freeze({
        sourceType: "STATIC_FIXTURE",
        isSynthetic: true,
      }),

      valueSemantics: "ILLUSTRATIVE_ONLY",

      snapshotId: null,
      analysisStatus: null,
      observationScope: null,

      sampleCounts: null,
      sentimentCounts: null,
      sentimentDenominator: null,

      observedAt: null,
      analyzedAt: null,
    });

    return Object.freeze({
      isSynthetic: true,
      source: "STATIC_FIXTURE",
      targetType,
      targetId,
      previewContract,
      title: targetType === "VIDEO" ? "영상 반응 미리보기" : "채널 반응 미리보기",
      scopeLabel: targetType === "CHANNEL" ? "선정 영상 8개 (가상)" : "단일 영상 (가상)",
      sampleLabel: "예시 댓글 " + sample.sample + "건 (가상)",
      periodLabel: "기간: 지정되지 않음 (가상)",
      updatedLabel: "실제 갱신 시각 없음",
      positive: sample.positive,
      neutral: sample.neutral,
      negative: sample.negative,
      topics: Object.freeze(["표현 방식 (가상)", "정보 이해도 (가상)"]),
      briefing: "표시된 분포와 논점은 실제 댓글을 분석하지 않은 화면 시연용 예시입니다.",
    });
  }

  scope.YUTOPIA_HOVER_CARD_MODEL = Object.freeze({mockForTarget});
})(globalThis);
