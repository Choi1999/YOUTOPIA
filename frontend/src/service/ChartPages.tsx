import { GamePublications } from "./GamePublications";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { appIds, periodDays, periodSearch, videoId } from "./queryState";
import { GameAnalysisLinks } from "./GameAnalysisPages";
import { serviceApi, ApiError, type RankPair } from "./api";
import { useInteractionEvents, usePageView } from "./Activity";
import { useSession } from "./SessionProvider";
import {
  Frame,
  StatePanel,
  ObservedChart,
  Unavailable,
  useResource,
  number,
  time,
} from "./components";
export function Bars({
  title,
  values,
  note,
}: {
  title: string;
  values: { label: string; value: number | null }[];
  note?: string;
}) {
  const valid = values.filter(
    (v) => v.value !== null && Number.isFinite(v.value),
  );
  if (!valid.length)
    return (
      <Unavailable title={title} reason="계산 가능한 관측값이 없습니다." />
    );
  const min = Math.min(0, ...valid.map((v) => v.value!)),
    max = Math.max(1, ...valid.map((v) => v.value!)),
    span = max - min;
  const y = (value: number) => 220 - ((value - min) / span) * 180;
  return (
    <section className="trend-chart-panel">
      <h2>{title}</h2>
      <div className="service-bar-plot">
        <svg viewBox="0 0 1000 280" role="img" aria-label={title}>
          <line
            x1="40"
            y1={y(0)}
            x2="980"
            y2={y(0)}
            stroke="var(--border-default)"
          />
          {valid.map((v, i) => {
            const width = Math.min(100, (900 / valid.length) * 0.7),
              x = 50 + ((i + 0.5) * 900) / valid.length;
            return (
              <g key={v.label + ":" + i}>
                <rect
                  x={x - width / 2}
                  width={width}
                  y={Math.min(y(0), y(v.value!))}
                  height={Math.abs(y(v.value!) - y(0))}
                  fill="var(--chart-bar-primary)"
                  rx="3"
                />
                <text
                  x={x}
                  y={v.value! >= 0 ? y(v.value!) - 8 : y(v.value!) + 16}
                  textAnchor="middle"
                >
                  {number(v.value)}
                </text>
                <text x={x} y="254" textAnchor="middle">
                  {v.label.length > 12 ? v.label.slice(0, 11) + "…" : v.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <details>
        <summary>차트 데이터 표</summary>
        <table className="game-table">
          <tbody>
            {values.map((v, i) => (
              <tr key={v.label + ":" + i}>
                <th>{v.label}</th>
                <td>{number(v.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {note && <p className="chart-caption">{note}</p>}
    </section>
  );
}
function Scatter({ values }: { values: RankPair[] }) {
  if (!values.length)
    return (
      <Unavailable
        title="06 · KR 대 국가 미지정 순위"
        reason="같은 주차의 두 지역 관측쌍이 없습니다."
      />
    );
  const max = Math.max(
    2,
    ...values.flatMap((v) => [v.krPosition, v.unspecifiedPosition]),
  );
  const x = (v: number) => 48 + ((v - 1) / (max - 1)) * 900,
    y = (v: number) => 24 + ((v - 1) / (max - 1)) * 210;
  return (
    <section className="trend-chart-panel">
      <h2>06 · KR 대 국가 미지정 순위</h2>
      <svg
        viewBox="0 0 1000 280"
        role="img"
        aria-label="동일 app ID와 주차의 지역 순위 산점도"
      >
        <line
          x1="48"
          y1="24"
          x2="948"
          y2="234"
          stroke="var(--text-muted)"
          strokeDasharray="4"
        />
        {values.map((v) => (
          <circle
            key={v.appId}
            cx={x(v.krPosition)}
            cy={y(v.unspecifiedPosition)}
            r="5"
            fill="var(--chart-bar-primary)"
          >
            <title>
              {v.name ?? v.appId}: KR {v.krPosition}, 미지정{" "}
              {v.unspecifiedPosition}
            </title>
          </circle>
        ))}
        <text x="48" y="270">
          KR 순위 → / 국가 미지정 순위 ↓ · 1위가 왼쪽·위
        </text>
      </svg>
      <p className="chart-caption">
        동일 순위선 · {values.length}개 실제 관측쌍
      </p>
    </section>
  );
}
function RankCharts() {
  const periods = useResource("ranking-periods", (s) => serviceApi.periods(s));
  const [params, setParams] = useSearchParams();
  const scope = params.get("rankScope") ?? "";
  const range = params.get("rankFrom") ?? "";
  const country = params.get("rankCountry") === "UNSPECIFIED" ? "UNSPECIFIED" : "KR";
  const trend = params.get("rankAppId") ?? "";
  function select(key: string, value: string, reset: string[] = []) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    reset.forEach(name => next.delete(name));
    setParams(next);
  }
  const content = periods.data?.content ?? [];
  const scopeKey = (p: {source: string; category: string | null}) =>
    JSON.stringify([p.source, p.category]);
  const choices = [...new Map(content.map((p) => [scopeKey(p), p])).entries()];
  const chosen = choices.find(([key]) => key === scope) ?? choices[0];
  const chosenKey = chosen?.[0] ?? "";
  const dates = content
    .filter((p) => scopeKey(p) === chosenKey)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const to = dates.at(-1)?.start;
  const weekMillis = 7 * 24 * 60 * 60 * 1000;
  // Spring checks the full instant. JS Date keeps only the first three fractional digits.
  const subMillisecondDigits = (value: string) => (value.match(/\.(\d{1,9})Z$/)?.[1] ?? "").slice(3).padEnd(6, "0");
  const selectableDates = dates.filter(period => {
    if (!to) return false;
    const weeks = (Date.parse(to) - Date.parse(period.start)) / weekMillis;
    return Number.isInteger(weeks) && weeks <= 12 && subMillisecondDigits(period.start) === subMillisecondDigits(to);
  });
  const from = selectableDates.find(period => period.start === range)?.start
    ?? selectableDates[Math.max(0, selectableDates.length - 3)]?.start;
  const key = chosenKey + ":" + from + ":" + to;
  const report = useResource(key, (s) =>
    chosen && from && to
      ? serviceApi.rankings(
          new URLSearchParams({
            source: chosen[1].source,
            ...(chosen[1].category === null ? {} : {category: chosen[1].category}),
            from,
            to,
          }),
          s,
        )
      : Promise.resolve(null),
  );
  const data = report.data;
  const last = data?.charts.weeks.at(-1),
    region = country === "KR" ? last?.kr : last?.unspecified;
  const series =
    data?.charts.lastThreeWeekTrends.filter((v) => v.country === country) ?? [];
  const selected = series.find((v) => String(v.appId) === trend) ?? series[0];
  return (
    <>
      <StatePanel
        loading={periods.loading || Boolean(chosen && report.loading)}
        error={periods.error || report.error}
        empty={Boolean(periods.data && !content.length)}
        retry={() => {
          periods.retry();
          report.retry();
        }}
      />
      <div className="game-filters">
        <label>
          관측 원천 / 범주
          <select
            value={chosenKey}
            onChange={(e) => {
              select("rankScope", e.target.value, ["rankFrom", "rankAppId"]);
            }}
          >
            {choices.map(([key, period]) => (
              <option key={key} value={key}>
                {period.source} / {period.category ?? "범주 미지정"}
              </option>
            ))}
          </select>
        </label>
        <label>
          시작 주차
          <select value={from ?? ""} onChange={(e) => select("rankFrom", e.target.value)}>
            {selectableDates.map((v) => (
                <option key={v.start + v.end} value={v.start}>
                  {time(v.start)}
                </option>
              ))}
          </select>
        </label>
        <label>
          지역
          <select value={country} onChange={(e) => select("rankCountry", e.target.value, ["rankAppId"])}>
            <option value="KR">KR</option>
            <option value="UNSPECIFIED">기본 / 국가 미지정</option>
          </select>
        </label>
      </div>
      {dates.length > 0 && (
        <p className="chart-caption">
          선택 원천의 관측 주간 종료 {time(dates.at(-1)?.end)}
        </p>
      )}
      {data && last && region && (
        <>
          <p className="chart-caption">
            {data.source} / {data.category ?? "범주 미지정"} · 마지막 선택 주차{" "}
            {time(last.periodStart)} · 조회 시각 {time(data.asOf)} · 신선도{" "}
            {data.freshness === "UNASSESSED" ? "판정 전" : data.freshness} ·{" "}
            {data.calculationVersion}
          </p>
          <p className="chart-caption">
            순위 게임명은 관측 당시 원천 표기이며 현재 카탈로그명과 다를 수 있습니다.
          </p>
          <label className="game-filters">
            3주 관측 게임
            <select
              value={selected ? String(selected.appId) : ""}
              onChange={(e) => select("rankAppId", e.target.value)}
            >
              {series.map((v) => (
                <option key={v.appId} value={v.appId}>
                  {v.name ?? v.appId}
                </option>
              ))}
            </select>
          </label>
          <div className="service-chart-grid">
            {selected ? (
              <ObservedChart
                title="01 · 3주간 게임별 주간 판매 순위"
                unit="위"
                invert
                points={selected.points.map((v) => ({
                  at: v.periodStart,
                  value: v.position,
                }))}
              />
            ) : (
              <Unavailable
                title="01 · 3주간 게임별 주간 판매 순위"
                reason="동일 게임의 3주 관측이 부족합니다."
              />
            )}
            <Bars
              title="02 · 전주 대비 순위 변화 분포"
              values={Object.entries(region.deltaHistogram)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([label, value]) => ({ label, value }))}
              note={`전주 순위−현재 순위 · 비교 가능 ${region.comparable}개 / 비교 불가 ${region.uncomparable}개`}
            />
            <Bars
              title="03 · 지역별 상승·하락·동일 비율"
              values={[
                { label: "KR 상승", value: last.kr.upRatio },
                { label: "KR 하락", value: last.kr.downRatio },
                { label: "KR 동일", value: last.kr.sameRatio },
                { label: "미지정 상승", value: last.unspecified.upRatio },
                { label: "미지정 하락", value: last.unspecified.downRatio },
                { label: "미지정 동일", value: last.unspecified.sameRatio },
              ]}
              note={`0~1 비율 · 분모 KR ${last.kr.comparable}, 국가 미지정 ${last.unspecified.comparable}. 미지정은 GLOBAL을 뜻하지 않습니다.`}
            />
            <Bars
              title="04 · 주간 순위 상승 폭 TOP10"
              values={region.topRisers.map((v) => ({
                label: v.name ?? String(v.appId),
                value: v.positionChange,
              }))}
              note={region.topRisers
                .map(
                  (v) => `${v.name ?? v.appId}: ${v.previous}→${v.current}위`,
                )
                .join(" / ")}
            />
            <Bars
              title="05 · 주간 순위 하락 폭 TOP10"
              values={region.topFallers.map((v) => ({
                label: v.name ?? String(v.appId),
                value: v.positionChange,
              }))}
              note={
                "판매량의 감소율이 아닙니다. " +
                region.topFallers
                  .map(
                    (v) => `${v.name ?? v.appId}: ${v.previous}→${v.current}위`,
                  )
                  .join(" / ")
              }
            />
            <Scatter values={last.pairs} />
            <Bars
              title="07 · 지역별 주간 순위 차이"
              values={last.largestGaps.map((v) => ({
                label: v.name ?? String(v.appId),
                value: v.absoluteGap,
              }))}
              note="동일 app ID·주차의 순위 차이 절대값"
            />
            <section className="trend-chart-panel" aria-label="지역별 원순위 비교">
              <h2>지역별 원순위 비교</h2>
              <p className="game-table-scroll-hint">표를 좌우로 움직여 지역별 원순위를 확인하세요.</p>
              <div className="game-table-wrap" role="region" aria-label="지역별 원순위 비교 가로 스크롤" tabIndex={0}>
                <table className="game-table"><thead><tr><th>게임</th><th>KR 순위</th><th>국가 미지정 순위</th><th>순위 차이</th></tr></thead>
                  <tbody>{last.largestGaps.map(value => <tr key={value.appId}><th>{value.name ?? value.appId}</th><td>{value.krPosition}위</td><td>{value.unspecifiedPosition}위</td><td>{value.absoluteGap}</td></tr>)}</tbody>
                </table>
              </div>
              {!last.largestGaps.length && <p>같은 주차에 비교 가능한 지역 관측쌍이 없습니다.</p>}
            </section>
            <Bars
              title="08 · TOP20 진입 및 매주 유지"
              values={data.charts.top20Continuity.flatMap((v) => [
                { label: v.country + " 관측 진입", value: v.enteredTop20 },
                { label: v.country + " 매주 유지", value: v.everyWeekTop20 },
              ])}
              note={
                data.charts.top20Continuity
                  .map(
                    (v) =>
                      `${v.country}: 관측 ${v.observedWeeks}/${v.expectedWeeks}주 (${v.availability})`,
                  )
                  .join(" / ") + ". 주차 누락 시 매주 유지는 미확인입니다."
              }
            />
          </div>
        </>
      )}
    </>
  );
}
function CcuSummaryCharts() {
  const [params, setParams] = useSearchParams();
  const applied = appIds(params.get("appIds"));
  const days = periodDays(params, 7);
  const [ids, setIds] = useState(applied);
  const [inputError, setInputError] = useState("");
  useEffect(() => { setIds(applied); setInputError(""); }, [applied]);
  const charts = useResource(applied + ":" + days, (s) =>
    applied
      ? serviceApi.ccuCharts(applied.split(",").map(Number), days, s)
      : Promise.resolve(null),
  );
  const types = useResource("active-app-types", (s) =>
    serviceApi.composition(s),
  );
  const data = charts.data;
  return (
    <>
      <form
        className="game-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const valid = appIds(ids);
          if (!valid) { setInputError("중복 없이 올바른 Steam app ID를 100개 이하로 입력해 주세요."); return; }
          const next = new URLSearchParams(params); next.set("appIds", valid); setParams(next);
        }}
      >
        <label>
          Steam app ID (쉼표 구분)
          <input
            aria-label="비교할 Steam app ID"
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            required
            pattern="[1-9][0-9]*(,[1-9][0-9]*)*"
            maxLength={1100}
          />
        </label>
        <label>
          관측 기간
          <select
            value={days}
            onChange={(e) => { const next = new URLSearchParams(params); next.set("days", e.target.value); setParams(next); }}
          >
            <option value="7">7일</option>
            <option value="30">30일</option>
          </select>
        </label>
        <button className="primary-action">관측 비교</button>
      </form>
      {(inputError || (params.has("appIds") && !applied)) && <p role="alert">{inputError || "URL의 Steam app ID를 확인해 주세요. 관측 조회를 실행하지 않았습니다."}</p>}
      <StatePanel
        loading={Boolean(applied && charts.loading)}
        error={charts.error}
        retry={charts.retry}
      />
      {data && (
        <div className="service-chart-grid">
          <Bars
            title="09 · Steam CCU 단기 변화율"
            values={data.recent.map((v) => ({
              label: String(v.appId),
              value: v.percent,
            }))}
            note={
              data.recent
                .map(
                  (v) =>
                    `${v.appId}: ${v.reason ?? "실제 " + v.elapsedSeconds + "초 간격"}`,
                )
                .join(" / ") + " · %"
            }
          />
          <Bars
            title="13 · 정확히 24시간 전 대비 게임 수"
            values={[
              { label: "상승", value: data.exact24Hours.up },
              { label: "하락", value: data.exact24Hours.down },
              { label: "동일", value: data.exact24Hours.same },
            ]}
            note={`요청 ${data.exact24Hours.requested}, 비교 가능 ${data.exact24Hours.comparable}, 제외 ${data.exact24Hours.excluded}. 누락 슬롯을 대체하지 않습니다.`}
          />
        </div>
      )}
      <StatePanel
        loading={types.loading}
        error={types.error}
        retry={types.retry}
      />
      {types.data &&
        (types.data.composition.total ? (
          <Bars
            title="14 · 활성 Steam 수집 대상 앱 구성"
            values={[
              { label: "게임", value: types.data.composition.games },
              { label: "비게임", value: types.data.composition.nonGames },
              { label: "유형 미확인", value: types.data.composition.unknown },
            ]}
            note={`고유 앱 ${types.data.composition.total}개. 플레이어 수가 아닙니다. 각 비율 게임 ${number(types.data.composition.gameRatio)}, 비게임 ${number(types.data.composition.nonGameRatio)}, 미확인 ${number(types.data.composition.unknownRatio)}.`}
          />
        ) : (
          <Unavailable
            title="14 · 활성 Steam 수집 대상 앱 구성"
            reason="현재 대상이 없어 분모가 0입니다."
          />
        ))}
    </>
  );
}
export function SteamChartsPage() {
  return (
    <Frame title="Steam 트렌드 차트">
      <RankCharts />
      <CcuSummaryCharts />
    </Frame>
  );
}
export function YoutubePage() {
  const { gameId } = useParams();
  return gameId ? <GameYoutubePage gameId={gameId} /> : <NativeYoutubePage />;
}
function QueryAssociations({ appId, days }: { appId: number; days: number }) {
  const session = useSession();
  const allowed = session.status === "authenticated" && session.identity?.kind === "USER";
  const links = useResource(appId + ":" + days + ":" + allowed, signal =>
    allowed ? serviceApi.associations([appId], days, signal) : Promise.resolve(null));
  if (session.status === "checking") return <StatePanel loading />;
  if (session.status === "unavailable") return <StatePanel error={new ApiError(503, "SESSION_UNAVAILABLE")} retry={() => { void session.refresh(); }} />;
  if (!allowed) return <Unavailable title="11 · 게임별 연결 영상과 비교 가능한 영상" reason="일반 회원으로 로그인한 뒤 조회할 수 있습니다." />;
  if (links.error instanceof ApiError && links.error.status === 404)
    return <Unavailable title="11 · 게임별 연결 영상과 비교 가능한 영상" reason="이 조회 기능이 현재 제공되지 않습니다. 연결 영상 0개를 뜻하지 않습니다." />;
  return <>
    <StatePanel loading={links.loading} error={links.error} retry={links.retry} />
    {links.data && (links.data.content.length > 0 ? <Bars
      title="11 · 검색어 연결 영상과 비교 가능한 영상"
      values={links.data.content.flatMap(value => [
        { label: value.appId + " 연결", value: value.queryAssociatedVideos },
        { label: value.appId + " 비교 가능", value: value.comparableVideos },
      ])}
      note="query 연결 근거 · 게임 관련성 미검증. 같은 영상의 서로 다른 유효 관측 슬롯이 2개 이상일 때만 비교 가능합니다."
    /> : <section className="trend-chart-panel" role="status"><h2>11 · 게임별 연결 영상과 비교 가능한 영상</h2><p>선택 기간에 조회된 검색어 연결 영상이 없습니다. YouTube 전체 영상 수를 뜻하지 않습니다.</p></section>)}
  </>;
}
function GameYoutubePage({ gameId }: { gameId: string }) {
  const context = useResource(gameId, signal => serviceApi.detail(gameId, signal));
  const location = useLocation();
  const [params] = useSearchParams();
  const days = periodDays(params);
  const detailUnavailable = context.error instanceof ApiError && context.error.status === 503;
  // The game page can load even when publication observations are unavailable.
  // GamePublications records the separately gated observation-view event later.
  usePageView("analysis.youtube", Boolean(context.data), context.data?.game.steamAppId, "YOUTUBE", false);
  return <Frame title={context.data ? context.data.game.name + " · YouTube" : "YouTube 관측 분석"}>
    <Link className="back-button" to={"/games/" + gameId + periodSearch(location.search, days)} state={location.state}>← 게임 상세</Link>
    <StatePanel loading={context.loading} error={context.error} retry={context.retry} />
    {context.data && <>
      <GameAnalysisLinks gameId={gameId} days={days} />
      <p className="chart-caption">Steam 앱 ID {context.data.game.steamAppId} · 게임별 YouTube 연결 {context.data.game.youtubeConnection === "CONNECTED" ? "검색어 연결" : "미확인"} · 게임 관련성 미검증</p>
    </>}
    {detailUnavailable && <p className="chart-caption">게임 상세 정보를 불러오지 못했습니다. 게시 영상은 별도로 조회합니다.</p>}
    {(context.data || detailUnavailable) && <GamePublications gameId={gameId} trackView />}
    {context.data && <>
      <QueryAssociations appId={context.data.game.steamAppId} days={days} />
      <Unavailable title="조회 증가량 · 댓글" reason="산정 기준과 댓글 원천이 준비되지 않았습니다. 0건을 뜻하지 않습니다." />
    </>}
  </Frame>;
}
function NativeYoutubePage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const applied = videoId(params.get("videoId"));
  const days = periodDays(params, 7);
  const [id, setId] = useState(applied);
  useEffect(() => { setId(applied); }, [applied]);
  const interaction = useInteractionEvents();
  const videos = useResource(applied + ":" + days, signal =>
    applied ? serviceApi.video(applied, days, signal) : Promise.resolve(null));
  usePageView("analysis.youtube", Boolean(videos.data));
  const returnTo = typeof location.state?.publicationReturnTo === "string" &&
    /^\/games\/steam:[1-9][0-9]{0,9}(?:\/youtube)?(?:\?|$)/.test(location.state.publicationReturnTo)
    ? location.state.publicationReturnTo : "/games";
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!videoId(id)) return;
    const next = new URLSearchParams(params); next.set("videoId", id);
    setParams(next, { state: location.state });
  }
  return <Frame title="YouTube 관측 분석">
    <Link className="back-button" to={returnTo} state={location.state?.publicationReturnState}>← 게시 영상 목록</Link>
    <p className="chart-caption"><Link to="/games">게임 목록에서 게임을 선택해 일별 게시 영상 확인 →</Link></p>
    <details open={Boolean(applied)}><summary>보조 도구 · 영상별 통계 관측</summary>
      <form className="game-filters" onSubmit={submit}>
        <label>영상 ID<input aria-label="YouTube 영상 ID" value={id} onChange={event => setId(event.target.value)} pattern="[A-Za-z0-9_-]{11}" minLength={11} maxLength={11} required /></label>
        <label>관측 기간<select value={days} onChange={event => {
          if (Number(event.target.value) === days) return;
          interaction({ type: "PERIOD_CHANGED", action: "analysis.period.change", properties: { fromPeriod: days + "d", toPeriod: event.target.value + "d" } });
          const next = new URLSearchParams(params); next.set("days", event.target.value); setParams(next, { state: location.state });
        }}><option value="7">7일</option><option value="30">30일</option></select></label>
        <button className="primary-action">실제 영상 관측 조회</button>
      </form>
      {params.has("videoId") && !applied && <p role="alert">URL의 영상 ID를 확인해 주세요. 관측 조회를 실행하지 않았습니다.</p>}
      <StatePanel loading={Boolean(applied && videos.loading)} error={videos.error} retry={videos.retry} />
      {videos.data && <>
        <p className="chart-caption">마지막 영상 관측 {time(videos.data.observations.at(-1)?.slot)} · 조회 시각 {time(videos.data.to)} · 신선도 {videos.data.freshness === "UNASSESSED" ? "판정 전" : videos.data.freshness}</p>
        <ObservedChart title="10 · 영상 최초·마지막 누적 조회수" unit="회" points={videos.data.observations.map(value => ({ at: value.slot, value: value.views }))} />
        <p className="chart-caption">최초 {number(videos.data.comparison.first?.views)} → 마지막 {number(videos.data.comparison.last?.views)} · 차이 {number(videos.data.comparison.cumulativeDifference)} · 실제 간격 {number(videos.data.comparison.elapsedSeconds)}초 · 게임 관련성을 뜻하지 않습니다.</p>
      </>}
    </details>
    <Unavailable title="12 · 조회 증가 가속도 계산 가능 비율" reason="관측 간격·최소 표본 정책 확정 전입니다. 0%를 뜻하지 않습니다." />
  </Frame>;
}
