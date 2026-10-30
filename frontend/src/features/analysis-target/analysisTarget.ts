
/**
 * YouTube 분석 대상을 식별하는 공통 프론트엔드 모델.
 *
 * 게임·음악·교육 등 영상 분야에 의존하지 않는다.
 * shared/contracts/analysis-v1의 AnalysisTarget 후보 규칙을 따른다.
 */

// 분석 대상의 종류: 영상 또는 채널
export type AnalysisTargetType = "VIDEO" | "CHANNEL";

// 분석 대상의 공통 데이터 구조
export type AnalysisTarget = Readonly<{
  source: "YOUTUBE";
  targetType: AnalysisTargetType;
  targetId: string;
}>;

// YouTube 영상 ID: 허용 문자 11개
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// YouTube 채널 ID: UC 접두사와 그 뒤의 문자 22개
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

/**
 * 전달받은 ID의 형식이 올바르면 AnalysisTarget을 생성한다.
 *
 * ID 형식만 검증하며 실제 영상·채널의 존재는 확인하지 않는다.
 * 유효하지 않은 ID와 미해결 @handle은 null을 반환한다.
 */
export function createAnalysisTarget(
  targetType: AnalysisTargetType,
  targetId: string,
): AnalysisTarget | null {
  const isValid =
    targetType === "VIDEO"
      ? VIDEO_ID_PATTERN.test(targetId)
      : targetType === "CHANNEL"
        ? CHANNEL_ID_PATTERN.test(targetId)
        : false;

  if (!isValid) {
    return null;
  }

  return {
    source: "YOUTUBE",
    targetType,
    targetId,
  };
}
