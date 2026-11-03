import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { GamePublications } from "./GamePublications";
import { InsightMetricGrid } from "../features/project-insights/InsightMetricGrid";
import { serviceApi, errorText, type Listing } from "./api";
import { usePageView, useInteractionEvents } from "./Activity";
import { useSession } from "./SessionProvider";
import {
  Frame,
  StatePanel,
  ObservedChart,
  Unavailable,
  useResource,
  metric,
  trackingLabel,
  time,
} from "./components";
export function GameListPage({ dashboard = false }: { dashboard?: boolean }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation(),
    navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState<unknown>();
  const [override, setOverride] = useState<{
    key: string;
    data: Listing;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const session = useSession();
  const interaction = useInteractionEvents();
  const classifications=useResource("game-classifications",signal=>serviceApi.classifications(signal));
  const selectedClassification=params.get("classification")??"ALL";
  const unknownClassification=selectedClassification!=="ALL"&&!classifications.data?.options.some(option=>option.id===selectedClassification);
  const query = params.toString(),
    resource = useResource(query + ":" + revision, (signal) =>
      override?.key === query
        ? Promise.resolve(override.data)
        : serviceApi.games(params, signal),
    );
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [query]);
  function change(key: string, value: string) {
    if (
      (params.get(key) ??
        (
          {
            sort: "dataAvailable",
            direction: "ASC",
            platform: "ALL",
            connectionStatus: "ALL",
            classification: "ALL",
          } as Record<string, string>
        )[key]) === value
    )
      return;
    const next = new URLSearchParams(params);
    next.set(key, value);
    if(key==="sort")next.set("direction",value==="currentCcu"||value==="peak24h"||value==="lastObservedAt"?"DESC":"ASC");
    if (key !== "page") next.set("page", "0");
    setOverride(null);
    setFailure(undefined);
    setParams(next);
    if (key === "sort" || key === "direction")
      interaction({
        type: "SORT_CHANGED",
        action: "games.sort.change",
        properties: {
          sortKey: next.get("sort") ?? "dataAvailable",
          direction: next.get("direction") ?? "ASC",
        },
      });
    if (key === "platform" || key === "connectionStatus")
      interaction({
        type: "FILTER_CHANGED",
        action: "games.filter.change",
        properties: { filterKey: key, filterValue: value },
      });
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    const next = new URLSearchParams(params);
    next.set("q", q);
    next.set("page", "0");
    try {
      const data = await serviceApi.search({
        q,
        page: 0,
        size: Number(params.get("size") ?? 20),
        sort: params.get("sort") ?? "dataAvailable",
        direction: params.get("direction") ?? "ASC",
        platform: params.get("platform") ?? "ALL",
        connectionStatus: params.get("connectionStatus") ?? "ALL",
        days: Number(params.get("days") ?? 30),
        classification: params.get("classification") ?? "ALL",
      });
      setOverride({ key: next.toString(), data });
      setRevision((n) => n + 1);
      setParams(next);
      const tracking = data.searchTracking;
      if (
        import.meta.env.VITE_PRODUCT_EVENTS_ENABLED === "true" &&
        (session.status === "guest" || session.identity?.kind === "USER") &&
        tracking?.availability === "AVAILABLE"
      )
        void serviceApi
          .request("/api/v1/events", {
            method: "POST",
            account: session.identity?.id,
            body: {
              clientEventId: tracking.clientEventId,
              eventType: "SEARCH_EXECUTED",
              actionKey: "games.search.execute",
              properties: tracking.properties,
              searchReceipt: tracking.receipt,
            },
          })
          .catch(() => {});
    } catch (error) {
      setFailure(error);
    } finally {
      setBusy(false);
    }
  }
  usePageView(dashboard ? "dashboard" : "game.list", Boolean(resource.data));
  const data = resource.data,
    returnTo = location.pathname + location.search;
  return (
    <Frame title={dashboard ? "게임 활동 현황" : "관측 게임 탐색"}>
      <form className="trend-filter-row game-filters" onSubmit={search}>
        <label>
          게임명
          <input
            aria-label="게임명 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={200}
            type="search"
          />
        </label>
        <button
          className="primary-action"
          disabled={busy || !q.trim()}
          type="submit"
        >
          검색
        </button>
        <label>
          플랫폼
          <select
            value={params.get("platform") ?? "ALL"}
            onChange={(e) => change("platform", e.target.value)}
          >
            <option value="ALL">전체 지원 플랫폼</option>
            <option value="STEAM">Steam</option>
            <option disabled>YouTube · 미지원</option>
          </select>
        </label>
        <label>
          수집 연결
          <select
            value={params.get("connectionStatus") ?? "ALL"}
            onChange={(e) => change("connectionStatus", e.target.value)}
          >
            <option value="ALL">전체</option>
            <option value="CONNECTED">현재 추적 활성</option>
            <option value="UNAVAILABLE">현재 활성 표시 없음</option>
            <option value="UNKNOWN">추적 상태 미확인</option>
          </select>
        </label>
        <label>
          수집 분류
          <select aria-describedby="game-classification-note" value={selectedClassification} onChange={e=>change("classification",e.target.value)} disabled={selectedClassification==="ALL"&&(classifications.loading||classifications.data?.state!=="AVAILABLE")}>
            <option value="ALL">전체</option>
            {unknownClassification&&<option value={selectedClassification} disabled>선택 분류 확인 불가</option>}
            {classifications.data?.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label>
          정렬
          <select
            value={params.get("sort") ?? "dataAvailable"}
            onChange={(e) => change("sort", e.target.value)}
          >
            <option value="dataAvailable">데이터 있는 게임 우선</option>
            <option value="name">게임명</option>
            <option value="currentCcu">마지막 관측 CCU</option>
            <option value="peak24h">24시간 최고 CCU</option>
            <option value="lastObservedAt">최근 CCU 관측 시각</option>
          </select>
        </label>
        <label>
          방향
          <select
            disabled={(params.get("sort") ?? "dataAvailable") === "dataAvailable"}
            value={params.get("direction") ?? "ASC"}
            onChange={(e) => change("direction", e.target.value)}
          >
            <option value="ASC">오름차순</option>
            <option value="DESC">내림차순</option>
          </select>
        </label>
        <label>데이터 판정 기간<select value={params.get("days") ?? "30"} onChange={e=>change("days",e.target.value)}><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label>
      </form>
      <p className="chart-caption" id="game-classification-note">{classifications.loading?"수집 분류 확인 중":classifications.error?"수집 분류를 불러오지 못했습니다. 장르가 없다는 뜻이 아닙니다.":classifications.data?.state==="AVAILABLE"?classifications.data.meaning:classifications.data?.state==="EMPTY"?"확인된 분류 수집 이력이 없습니다. 공식 장르가 없다는 뜻이 아닙니다.":"수집 분류 원천·권한을 확인할 수 없습니다. 전체 게임 목록은 계속 이용할 수 있습니다."}</p>
      <p className="chart-caption">데이터 우선은 인기·트렌드 순위가 아닙니다. 판정 기간 {params.get("days") ?? 30}일 · CCU는 관측 슬롯, YouTube는 한국 시간 게시일 기준입니다. 양쪽 → 한쪽 → 과거 데이터 → 확인된 데이터 없음 순이며, 일부 원천 미확인 게임은 부분 판정으로 표시합니다.</p>
      {Boolean(failure) && <p role="alert">{errorText(failure)}</p>}
      <StatePanel
        loading={resource.loading || busy}
        error={resource.error}
        empty={Boolean(data && !data.content.length)}
        retry={resource.retry}
      />
      {data && !resource.loading && !busy && (
        <>
          <p className="chart-caption">
            조회 기준 {time(data.asOf)} · {data.page.totalElements}개 · 신선도{" "}
            {data.freshness === "UNASSESSED" ? "판정 전" : data.freshness}
          </p>
          {data.freshness === "STALE" && (
            <div className="data-state-warning" role="status">
              수집 지연 · 마지막 관측 시각을 확인해 주세요.
            </div>
          )}
          {data.content.length > 0 && (
            <>
              <p className="game-table-scroll-hint">
                표를 좌우로 움직여 모든 관측 지표를 확인하세요.
              </p>
              <section
                className="source-cohort-ledger game-table-wrap"
                aria-label="관측 게임 목록 가로 스크롤"
                tabIndex={0}
              >
                <table className="game-table">
                  <caption className="sr-only">관측 게임 목록</caption>
                  <thead>
                    <tr>
                      <th>게임</th>
                      <th>연결 / 개발사</th>
                      <th>마지막 관측 CCU</th>
                      <th>24시간 최고</th>
                      <th>신규 영상</th>
                      <th>최근 관측</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((game, index) => {
                      const state = {
                        returnTo,
                        searchContextId: data.searchTracking?.searchContextId,
                        resultPosition:
                          data.page.number * data.page.size + index + 1,
                      };
                      return (
                        <tr
                          key={game.gameId}
                          tabIndex={0}
                          onClick={(e) => {
                            if (!(e.target as HTMLElement).closest("a,button"))
                              navigate("/games/" + game.gameId, { state });
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              e.currentTarget === e.target
                            )
                              navigate("/games/" + game.gameId, { state });
                          }}
                          aria-label={game.name + " 상세 보기"}
                        >
                          <td>
                            <Link to={"/games/" + game.gameId} state={state}>
                              {game.name}
                            </Link>
                            <small>Steam {game.steamAppId}</small>
                          </td>
                          <td>
                            {trackingLabel(game.steamConnection)}
                            <small>Steam: {game.evidence?.steam === "IN_PERIOD" ? "기간 내 관측 있음" : game.evidence?.steam === "HISTORICAL_ONLY" ? "과거 관측 있음" : game.evidence?.steam === "EMPTY" ? "관측 없음" : "미확인"}</small>
                            <small>YouTube: {game.evidence?.youtube === "IN_PERIOD" ? "기간 내 게시 영상 있음" : game.evidence?.youtube === "HISTORICAL_ONLY" ? "과거 게시 영상 있음" : game.evidence?.youtube === "EMPTY" ? "관측한 게시 영상 없음" : "미확인"} · {game.evidence?.completeness === "COMPLETE" ? "전체 판정" : "부분 판정"}</small>
                            <small>
                              {game.developers.value?.length
                                ? game.developers.value.join(", ")
                                : game.developers.availability === "EMPTY"
                                  ? "개발사 정보 없음"
                                  : "개발사 정보 미지원"}
                            </small>
                          </td>
                          <td>{metric(game.currentCcu)}</td>
                          <td>{metric(game.peak24h)}</td>
                          <td>{metric(game.newYoutubeVideos)}</td>
                          <td>{time(game.currentCcu.observedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </>
          )}
          <nav className="game-pagination" aria-label="게임 페이지">
            <button
              className="back-button"
              disabled={data.page.number === 0}
              onClick={() => change("page", "0")}
            >
              처음
            </button>
            <button
              className="back-button"
              disabled={data.page.number === 0}
              onClick={() => change("page", String(data.page.number - 1))}
            >
              이전
            </button>
            <span>
              {data.page.number + 1} / {Math.max(1, data.page.totalPages)}
            </span>
            <button
              className="back-button"
              disabled={data.page.number + 1 >= data.page.totalPages}
              onClick={() => change("page", String(data.page.number + 1))}
            >
              다음
            </button>
          </nav>
        </>
      )}
    </Frame>
  );
}
export function GameDetailPage() {
  const { gameId = "" } = useParams();
  const location = useLocation();
  const resource = useResource(gameId, (signal) =>
    serviceApi.detail(gameId, signal),
  );
  const data = resource.data;
  const once = useRef(new Set<string>());
  const session = useSession();
  usePageView("game.detail", Boolean(data), data?.game.steamAppId);
  useEffect(() => {
    const key = location.key + ":" + gameId;
    if (
      !data ||
      (session.status !== "guest" && session.identity?.kind !== "USER") ||
      once.current.has(key) ||
      import.meta.env.VITE_PRODUCT_EVENTS_ENABLED !== "true"
    )
      return;
    once.current.add(key);
    const state = location.state as {
      searchContextId?: string;
      resultPosition?: number;
    } | null;
    const context =
      state?.searchContextId &&
      Number.isInteger(state.resultPosition) &&
      state.resultPosition! > 0
        ? state.searchContextId
        : undefined;
    void serviceApi
      .request("/api/v1/events", {
        method: "POST",
        account: session.identity?.id,
        body: {
          clientEventId: crypto.randomUUID(),
          eventType: "GAME_VIEW",
          actionKey: "game.detail.view",
          properties: {
            appId: data.game.steamAppId,
            source: context ? "SEARCH_RESULT" : "DIRECT",
            ...(context
              ? {
                  searchContextId: context,
                  resultPosition: state!.resultPosition,
                }
              : {}),
          },
        },
      })
      .catch(() => {});
  }, [data, gameId, location.key, session.status, session.generation]);
  const back =
    typeof location.state?.returnTo === "string" &&
    /^\/(games|dashboard)(\?|$)/.test(location.state.returnTo)
      ? location.state.returnTo
      : "/games";
  return (
    <Frame title={data?.game.name ?? "게임 상세"}>
      <Link className="back-button" to={back}>
        ← 게임 목록
      </Link>
      <StatePanel
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
      />
      {data && (
        <>
          <p className="chart-caption">
            {data.game.developers.value?.length
              ? data.game.developers.value.join(", ")
              : data.game.developers.availability === "EMPTY"
                ? "개발사 정보 없음"
                : "개발사 미지원"}{" "}
            ·{" "}
            {data.game.releaseAt.value
              ? time(data.game.releaseAt.value)
              : "출시일 정보 없음"}{" "}
            · Steam{" "}
            {trackingLabel(data.game.steamConnection)}{" "}
            · YouTube{" "}
            {data.game.youtubeConnection === "CONNECTED" ? "검색어 연결" : "연결 상태 미확인"}
          </p>
          <p className="chart-caption">현재 활성 표시가 없어도 과거 관측은 유지됩니다. 비활성·대상 미등록 여부는 이 정보만으로 구분할 수 없습니다. 추적 활성은 최근 수집 성공을 뜻하지 않습니다.</p>
          <InsightMetricGrid
            metrics={[
              {
                label: "마지막 관측 CCU",
                value: metric(data.game.currentCcu,"기준 시각까지 관측 없음"),
                note: time(data.game.currentCcu.observedAt),
              },
              {
                label: "24시간 최고 CCU",
                value: metric(data.game.peak24h,"최근 24시간 관측 없음"),
                note: "실제 관측값 기준",
              },
              {
                label: "신규 YouTube 영상",
                value: metric(data.game.newYoutubeVideos),
                note: "최근 30일 한국 시간 게시일 · 검색으로 관측한 영상",
              },
              {
                label: "댓글 / Steam 리뷰",
                value: "데이터 미지원",
                note: "원천 미연결",
              },
            ]}
          />
          <ObservedChart
            title="최근 30일 Steam CCU"
            points={data.steamPreview.points.map((p) => ({
              at: p.scheduledAt,
              value: p.playerCount,
            }))}
          />
          <nav className="game-pagination">
            <Link
              className="primary-action"
              state={location.state}
              to={"/games/" + gameId + "/steam"}
            >
              Steam 분석 →
            </Link>
            <Link
              className="primary-action"
              state={location.state}
              to={"/games/" + gameId + "/youtube"}
            >
              YouTube 관측 →
            </Link>
          </nav>
          <GamePublications gameId={gameId} />
          <Unavailable
            title="리뷰 · 관련 이벤트"
            reason="승인된 원천이 연결되면 실제 관측값을 표시합니다."
          />
        </>
      )}
    </Frame>
  );
}
export function SteamGamePage() {
  const { gameId = "" } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const days = Number(params.get("days") ?? 7);
  const interaction = useInteractionEvents();
  const context = useResource(gameId, (s) => serviceApi.detail(gameId, s));
  const resource = useResource(
    gameId + ":" + days + ":" + Boolean(context.data),
    (signal) =>
      context.data
        ? days === 30
          ? Promise.resolve(context.data.steamPreview)
          : serviceApi.ccu(context.data.game.steamAppId, days, signal)
        : Promise.resolve(null),
  );
  usePageView(
    "analysis.steam",
    Boolean(resource.data),
    context.data?.game.steamAppId,
    "STEAM",
  );
  return (
    <Frame
      title={
        context.data ? context.data.game.name + " · Steam" : "Steam 관측 분석"
      }
    >
      <Link
        className="back-button"
        state={location.state}
        to={"/games/" + gameId}
      >
        ← 게임 상세
      </Link>
      <label className="game-filters">
        관측 기간
        <select
          value={days}
          onChange={(e) => {
            if (Number(e.target.value) === days) return;
            interaction({
              type: "PERIOD_CHANGED",
              action: "analysis.period.change",
              properties: {
                fromPeriod: days + "d",
                toPeriod: e.target.value + "d",
              },
            });
            setParams({ days: e.target.value });
          }}
        >
          <option value="7">7일</option>
          <option value="30">30일</option>
          <option disabled value="90">
            90일 · 미지원
          </option>
        </select>
      </label>
      <StatePanel
        loading={context.loading || Boolean(context.data && resource.loading)}
        error={context.error || resource.error}
        retry={() => {
          context.retry();
          resource.retry();
        }}
      />
      {resource.data && (
        <>
          <p className="chart-caption">
            마지막 관측 {time(resource.data.lastObservedAt)} · 신선도{" "}
            {resource.data.freshnessStatus === "UNASSESSED"
              ? "판정 전"
              : resource.data.freshnessStatus}
          </p>
          <ObservedChart
            title="Steam CCU"
            points={resource.data.points.map((p) => ({
              at: p.scheduledAt,
              value: p.playerCount,
            }))}
          />
          <Unavailable
            title="Steam 리뷰"
            reason="리뷰 원천이 연결되지 않았습니다."
          />
        </>
      )}
    </Frame>
  );
}
