import { Link, NavLink, useLocation, useParams, useSearchParams } from "react-router-dom";
import { serviceApi } from "./api";
import { Frame, StatePanel, Unavailable, useResource } from "./components";
import { periodDays, periodSearch } from "./queryState";
import { usePageView } from "./Activity";

const analyses = [
  ["steam", "Steam 분석 →"], ["youtube", "YouTube 관측 →"],
  ["reactions", "사용자 반응 →"], ["keywords", "키워드 분석 →"], ["events", "게임 이벤트 →"],
] as const;

export function GameAnalysisLinks({ gameId, days }: { gameId: string; days: 7 | 30 }) {
  const location = useLocation();
  return <nav className="game-pagination" aria-label="선택 게임 분석">
    {analyses.map(([path, title]) => <NavLink key={path} className="primary-action" state={location.state} to={"/games/" + gameId + "/" + path + periodSearch(location.search, days)}>{title}</NavLink>)}
  </nav>;
}

const titles = { reactions: "사용자 반응 분석", keywords: "키워드 분석", events: "게임 관련 이벤트" };
const telemetry = { reactions: ["analysis.reaction", "REACTION"], keywords: ["analysis.keyword", "KEYWORD"], events: ["analysis.event", "EVENT"] } as const;
/** These P0 screens expose the real game context and unavailable source states.
 * They do not substitute YouTube demo snapshots for unconnected game analysis. */
export function GameAnalysisPage({ kind }: { kind: keyof typeof titles }) {
  const { gameId = "" } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const days = periodDays(params);
  const context = useResource(gameId, signal => serviceApi.detail(gameId, signal));
  // EventCatalog's ANALYSIS_VIEW records a successfully opened analysis screen,
  // including its explicit unavailable state. It does not record an analysis run.
  // No period-success, keyword-selection or event-selection is manufactured.
  usePageView(telemetry[kind][0], Boolean(context.data), context.data?.game.steamAppId, telemetry[kind][1]);
  return <Frame title={context.data ? context.data.game.name + " · " + titles[kind] : titles[kind]}>
    <Link className="back-button" to={"/games/" + gameId + periodSearch(location.search, days)} state={location.state}>← 게임 상세</Link>
    <StatePanel loading={context.loading} error={context.error} retry={context.retry} />
    {context.data && <>
      <GameAnalysisLinks gameId={gameId} days={days} />
      <div className="game-filters">
        <label>관측 기간<select value={days} onChange={event => {
          const next = new URLSearchParams(params); next.set("days", event.target.value);
          next.delete("videoDate"); next.delete("videoPage");
          setParams(next, { state: location.state });
        }}><option value="7">7일</option><option value="30">30일</option></select></label>
        {kind === "events" && <label>이벤트 유형<select disabled aria-describedby="event-type-availability"><option>유형 정보 미지원</option></select></label>}
      </div>
      <p className="chart-caption">선택 게임 · {context.data.game.name} · 관측 기간 {days}일. 기간 선택은 화면 문맥을 유지하며, 연결되지 않은 분석을 실행하지 않습니다.</p>
      {kind === "reactions" && <>
        <div className="service-chart-grid">{["긍정 반응", "부정 반응", "복합 반응"].map(title => <Unavailable key={title} title={title} reason="게임 반응 분석 원천이 연결되지 않았습니다. 반응이 없다는 뜻이 아닙니다." />)}</div>
        <aside className="trend-chart-panel" aria-label="반응 상세"><header><h2>반응 상세</h2></header></aside>
      </>}
      {kind === "keywords" && <>
        <Unavailable title="기간별 키워드 변화" reason="키워드 분석 원천이 연결되지 않았습니다. 시계열을 조회할 수 없습니다." />
        <Unavailable title="신규 키워드 · 변화 요약" reason="검증된 키워드와 요약이 제공되지 않습니다. 키워드 0개를 뜻하지 않습니다." />
      </>}
      {kind === "events" && <>
        <p id="event-type-availability" className="chart-caption">이벤트 원천과 유형 목록이 연결되지 않아 유형별 조회를 사용할 수 없습니다.</p>
        <Unavailable title="게임 이벤트 목록" reason="이벤트 원천이 연결되지 않았습니다. 확인된 이벤트 없음과 구분합니다." />
        <aside className="trend-chart-panel" aria-label="이벤트 상세"><header><h2>이벤트 상세</h2></header></aside>
      </>}
    </>}
  </Frame>;
}
