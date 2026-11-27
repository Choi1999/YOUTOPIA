import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useInteractionEvents, usePageView } from "./Activity";
import { ApiError, serviceApi } from "./api";
import { StatePanel, number, time, useResource } from "./components";
import { calendarDate, pageNumber, periodDays } from "./queryState";
import { YoutubeObservationSummary } from "./ObservationSummary";

export function GamePublications({ gameId, trackView = false }: { gameId: string; trackView?: boolean }) {
  const [url, setUrl] = useSearchParams();
  const location = useLocation();
  const days = periodDays(url);
  const scope = url.get("videoScope") === "period" ? "period" : "date";
  const date = scope === "date" ? calendarDate(url.get("videoDate")) : "";
  const page = pageNumber(url.get("videoPage"));
  const params = new URLSearchParams({ days: String(days), page: String(page) });
  // Omit the default scope so existing date-only servers remain compatible.
  if (scope === "period") params.set("scope", "period");
  if (date) params.set("date", date);
  const resource = useResource(gameId + ":" + params, signal => serviceApi.publications(gameId, params, signal));
  const data = resource.data, videos = data?.videos;
  const scopeMismatch = Boolean(data && ["AVAILABLE", "EMPTY"].includes(data.dataStatus) && scope === "period" && data.videoScope !== "period");
  const interaction = useInteractionEvents();
  const pendingPeriod = useRef<{ from: number; to: number } | null>(null);
  const ready = Boolean(data && !scopeMismatch && ["AVAILABLE", "EMPTY"].includes(data.dataStatus));
  usePageView("analysis.youtube", trackView && ready, data?.appId, "YOUTUBE");
  useEffect(() => {
    const change = pendingPeriod.current;
    if (change && ready && data?.days === change.to && days === change.to) {
      pendingPeriod.current = null;
      interaction({ type: "PERIOD_CHANGED", action: "analysis.period.change", properties: { fromPeriod: change.from + "d", toPeriod: change.to + "d" } });
    }
  }, [ready, data, days, interaction]);
  function select(changes: Record<string, string | null>) {
    const next = new URLSearchParams(url);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key); else next.set(key, value);
    }
    setUrl(next, { state: location.state });
  }
  return <section className="trend-chart-panel publication-panel" aria-label="게임명 검색으로 관측한 게시 영상">
    <h2>게임명 검색으로 관측한 일별 신규 게시 영상</h2>
    <p className="chart-caption">게임의 검색어와 연결된 영상 기준이며 내용의 관련성은 미검증입니다. YouTube 전체 업로드 수가 아닙니다. 게시일은 한국 시간 기준, 같은 영상은 게임별 한 번만 계산합니다. 오늘은 진행 중이며 과거 집계도 추가 발견으로 바뀔 수 있습니다. 검색 범위·최근 수집 성공 여부는 미확인입니다.</p>
    <div className="game-filters">
      <label>게시 영상 기간<select value={days} onChange={e => {
        if (Number(e.target.value) === days) return;
        pendingPeriod.current = { from: days, to: Number(e.target.value) };
        select({ days: e.target.value, videoDate: null, videoPage: null });
      }}><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label>
      <label>게시 영상 범위<select value={scope} onChange={e => select({ videoScope: e.target.value, videoDate: null, videoPage: null })}><option value="date">선택 날짜</option><option value="period">선택 기간 전체</option></select></label>
    </div>
    <StatePanel loading={resource.loading} error={resource.error || (scopeMismatch ? new ApiError(0, "INVALID_RESPONSE") : undefined)} retry={resource.retry} />
    {data && !scopeMismatch && <YoutubeObservationSummary data={data} days={days} />}
    {data && !["AVAILABLE", "EMPTY"].includes(data.dataStatus) && <div><p role="status">게시 영상 상태 미확인 · {data.dataStatus === "PENDING_CONTRACT" ? "게임-검색어-검색 결과의 승인된 조회 연결 준비가 필요합니다." : "조회 권한과 연결 상태 확인이 필요합니다."} 영상 0개를 뜻하지 않습니다.</p><button onClick={resource.retry}>게시 영상 다시 확인</button></div>}
    {data && videos && ready && <>
      <p className="chart-caption">기준 {time(data.asOf)} · 전체 연결 이력 중 게시 시각 누락 {number(data.missingPublishedAt)}개(날짜 집계 제외) · 수집 범위 완전성 미확인</p>
      <div className="publication-days" role="group" aria-label="게시일별 영상 수 차트">
        {data.points.map(point => <button key={point.date} aria-pressed={scope === "date" && data.selectedDate === point.date} onClick={() => select({ videoScope: "date", videoDate: point.date, videoPage: null })} aria-label={point.date + " 관측 영상 " + point.observedVideos + "개" + (point.inProgress ? " 진행 중" : "")}>
          <span aria-hidden="true" className="publication-bar" style={{ height: Math.max(2, 80 * point.observedVideos / Math.max(1, ...data.points.map(value => value.observedVideos))) }} />
          <span>{point.date.slice(5)}</span><strong>{point.observedVideos}</strong>{point.inProgress && <small>진행 중</small>}
        </button>)}
      </div>
      <h3>{scope === "period" ? "선택한 " + data.days + "일" : data.selectedDate} 게시 영상 · {videos.page.totalElements}개 관측</h3>
      {videos.content.length === 0 ? videos.page.totalElements === 0
        ? <p>선택 {scope === "period" ? "기간" : "날짜"}에 관측한 게시 영상 없음 · 실제 게시량 0개를 뜻하지 않습니다.</p>
        : <div role="status"><p>현재 페이지에 표시할 영상이 없습니다. 선택 범위에는 {videos.page.totalElements}개 영상이 관측되었습니다.</p><button onClick={() => select({ videoPage: null })}>첫 영상 페이지로</button></div>
        : <ul className="publication-videos">{videos.content.map(video => <li key={video.videoId}>
        <a href={"https://www.youtube.com/watch?v=" + encodeURIComponent(video.videoId)} target="_blank" rel="noopener noreferrer">{video.title?.trim() || "제목 정보 없음"}</a>
        {" · "}<Link to={"/charts/youtube?" + new URLSearchParams({ videoId: video.videoId, days: String(days) })} state={{ publicationReturnTo: location.pathname + location.search, publicationReturnState: location.state }}>저장된 영상 통계 보기</Link>
        <small>게시 {time(video.publishedAt)} · 최초 발견 {time(video.firstObservedAt)}</small>
      </li>)}</ul>}
      <nav aria-label="게시 영상 페이지"><button disabled={videos.page.number === 0} onClick={() => select({ videoPage: String(Math.max(0, videos.page.number - 1)) })}>이전 영상</button><button disabled={!videos.page.hasNext} onClick={() => select({ videoPage: String(videos.page.number + 1) })}>다음 영상</button></nav>
    </>}
  </section>;
}
