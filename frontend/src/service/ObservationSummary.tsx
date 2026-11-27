import type { Metric, Publications } from "./api";
import { number, time } from "./components";

export type GameAvailability = {
  reviewAvailability?: string;
  analysisAvailability?: string;
  gameEventAvailability?: string;
};

type SummaryMetric = { label: string; value: string; note: string };

function ObservationGrid({ label, metrics }: { label: string; metrics: SummaryMetric[] }) {
  return (
    <section className="insight-metric-grid" aria-label={label}>
      {metrics.map((item) => (
        <article className="insight-metric-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </article>
      ))}
    </section>
  );
}

function availabilityLabel(state: string | undefined) {
  switch (state) {
    case "UNAVAILABLE": return "데이터 미지원";
    case "EMPTY": return "확인된 결과 없음";
    case "AVAILABLE": return "제공 가능 · 상세 확인 필요";
    case "PARTIAL": return "일부 데이터만 제공";
    case "STALE": return "최신성 기준 초과";
    case "PENDING_CONTRACT": return "조회 연결 준비 중";
    case "PERMISSION_UNCONFIRMED": return "조회 권한 미확인";
    case "ERROR": return "조회 오류";
    default: return "상태 미확인";
  }
}

/** Availability has no count or event payload; never manufacture either. */
export function GameAvailabilityBadges({ game }: { game: GameAvailability }) {
  return (
    <div aria-label="추가 관측 가용성">
      <small>댓글·텍스트 분석: {availabilityLabel(game.analysisAvailability)}</small>
      <small>Steam 리뷰: {availabilityLabel(game.reviewAvailability)}</small>
      <small>최근 게임 이벤트: {availabilityLabel(game.gameEventAvailability)}</small>
    </div>
  );
}

function ccuValue(metric: Metric) {
  if (metric.availability !== "AVAILABLE") return availabilityLabel(metric.availability);
  if (metric.value === null || !Number.isSafeInteger(metric.value) || metric.value < 0 ||
      !metric.observedAt || !Number.isFinite(Date.parse(metric.observedAt))) {
    return "관측 정보 미확인";
  }
  return `${number(metric.value)}명`;
}

function observationTime(metric: Metric) {
  return metric.availability === "AVAILABLE" && metric.observedAt && Number.isFinite(Date.parse(metric.observedAt))
    ? `관측 ${time(metric.observedAt)}`
    : "실제 관측값과 관측 시각을 함께 확인합니다.";
}

export function SteamObservationSummary({ game }: {
  game: { currentCcu: Metric; peak24h: Metric } & GameAvailability;
}) {
  return (
    <ObservationGrid label="Steam 관측 요약" metrics={[
      { label: "현재 CCU", value: ccuValue(game.currentCcu), note: `마지막 실제 관측값 · ${observationTime(game.currentCcu)}` },
      { label: "24시간 최고 CCU", value: ccuValue(game.peak24h), note: `최근 24시간 실제 관측 범위 · ${observationTime(game.peak24h)}` },
      { label: "Steam 리뷰", value: availabilityLabel(game.reviewAvailability), note: "리뷰 건수와 분석 결과는 제공된 원천 범위에서만 표시합니다." },
    ]} />
  );
}

function usableSummary(data: Publications | null | undefined, days: 7 | 30) {
  const summary = data?.summary;
  if (!data || data.days !== days || data.timezone !== "Asia/Seoul" || !["AVAILABLE", "EMPTY"].includes(data.dataStatus) ||
      !summary || summary.population !== "QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF" ||
      !Number.isFinite(Date.parse(data.asOf))) return null;
  const counts = [summary.observedVideos, summary.publishedVideos, summary.periodVideos,
    summary.missingPublishedAt, summary.futurePublishedAt];
  if (counts.some((value) => !Number.isSafeInteger(value) || value < 0) ||
      summary.observedVideos !== summary.publishedVideos + summary.missingPublishedAt + summary.futurePublishedAt ||
      summary.periodVideos > summary.publishedVideos) return null;
  return summary;
}

/** The server summary owns the selected-period and discovery-cohort counts. */
export function YoutubeObservationSummary({ data, days }: { data?: Publications | null; days: 7 | 30 }) {
  const summary = usableSummary(data, days);
  const unavailable = !data ? "확인 중" : data.days !== days ? "선택 기간 확인 중"
    : ["AVAILABLE", "EMPTY"].includes(data.dataStatus)
      ? data.summary ? "요약 정보 미확인" : "요약 미제공"
      : availabilityLabel(data.dataStatus);
  return (
    <>
      <ObservationGrid label="YouTube 관측 요약" metrics={[
        { label: `최근 ${days}일 게시 관측 영상`, value: summary ? `${number(summary.periodVideos)}개` : unavailable,
          note: "KST 게시일 기준 · 오늘 진행 중 · YouTube 전체 업로드 수가 아닙니다." },
        { label: "누적 연결 관측 영상", value: summary ? `${number(summary.observedVideos)}개` : unavailable,
          note: "기준 시각까지 발견한 고유 영상 · 검색어 연결이며 내용 관련성은 미검증입니다." },
        { label: "조회 증가량", value: "데이터 미지원", note: "승인된 기간 증가량 계약이 없습니다." },
        { label: "댓글 관측", value: "데이터 미지원", note: "댓글 원천 계약이 연결되지 않았습니다." },
      ]} />
      {summary && data && (
        <p className="chart-caption">
          집계 기준 {time(data.asOf)} · 누적 연결 관측 {number(summary.observedVideos)}개 중 게시 시각 확인 {number(summary.publishedVideos)}개,
          게시 시각 누락 {number(summary.missingPublishedAt)}개, 미래 게시 시각 {number(summary.futurePublishedAt)}개.
          누락·미래 게시 시각 항목은 선택 기간 합계에서 제외합니다. 수집 범위 완전성은 미확인입니다.
          {summary.latestFirstObservedAt && Number.isFinite(Date.parse(summary.latestFirstObservedAt)) &&
            <> 최근 최초 발견 {time(summary.latestFirstObservedAt)}. 발견 시각은 수집 최신성 판정과 다릅니다.</>}
        </p>
      )}
    </>
  );
}
