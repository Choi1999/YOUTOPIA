import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
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
  const [scope, setScope] = useState("");
  const [range, setRange] = useState("");
  const [country, setCountry] = useState("KR");
  const [trend, setTrend] = useState("");
  const content = periods.data?.content ?? [];
  const scopeKey = (p: {source: string; category: string | null}) =>
    JSON.stringify([p.source, p.category]);
  const choices = [...new Map(content.map((p) => [scopeKey(p), p])).entries()];
  const chosen = choices.find(([key]) => key === scope) ?? choices[0];
  const chosenKey = chosen?.[0] ?? "";
  const dates = content
    .filter((p) => scopeKey(p) === chosenKey)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const to = dates.at(-1)?.start,
    from = range || dates[Math.max(0, dates.length - 3)]?.start;
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
              setScope(e.target.value);
              setRange("");
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
          <select value={from ?? ""} onChange={(e) => setRange(e.target.value)}>
            {dates
              .filter(
                (v) =>
                  to && Date.parse(to) - Date.parse(v.start) <= 84 * 86400000,
              )
              .map((v) => (
                <option key={v.start + v.end} value={v.start}>
                  {time(v.start)}
                </option>
              ))}
          </select>
        </label>
        <label>
          지역
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="KR">KR</option>
            <option value="UNSPECIFIED">기본 / 국가 미지정</option>
          </select>
        </label>
      </div>
      {data && last && region && (
        <>
          <p className="chart-caption">
            {data.source} / {data.category ?? "범주 미지정"} · 마지막 선택 주차{" "}
            {time(last.periodStart)} · {data.calculationVersion}
          </p>
          <label className="game-filters">
            3주 관측 게임
            <select
              value={selected ? String(selected.appId) : ""}
              onChange={(e) => setTrend(e.target.value)}
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
  const [ids, setIds] = useState("");
  const [applied, setApplied] = useState("");
  const [days, setDays] = useState(7);
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
          setApplied(ids);
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
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="7">7일</option>
            <option value="30">30일</option>
          </select>
        </label>
        <button className="primary-action">관측 비교</button>
      </form>
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
  const session = useSession();
  const { gameId } = useParams();
  const context = useResource(gameId ?? "native-video", (s) =>
    gameId ? serviceApi.detail(gameId, s) : Promise.resolve(null),
  );
  const appId = context.data?.game.steamAppId;
  const interaction = useInteractionEvents();
  const [id, setId] = useState(""),
    [applied, setApplied] = useState(""),
    [days, setDays] = useState(7);
  const videos = useResource(applied + ":" + days, (s) =>
    applied ? serviceApi.video(applied, days, s) : Promise.resolve(null),
  );
  const links = useResource(String(appId) + ":" + days, (s) =>
    appId && session.identity?.kind === "USER"
      ? serviceApi.associations([appId], days, s) : Promise.resolve(null),
  );
  usePageView(
    "analysis.youtube",
    Boolean(context.data || videos.data),
    appId,
    appId ? "YOUTUBE" : undefined,
  );
  function submit(e: FormEvent) {
    e.preventDefault();
    setApplied(id);
  }
  if (gameId && !context.data)
    return (
      <Frame title="YouTube 관측 분석">
        <StatePanel
          loading={context.loading}
          error={context.error}
          retry={context.retry}
        />
      </Frame>
    );
  return (
    <Frame
      title={
        context.data
          ? context.data.game.name + " · YouTube"
          : "YouTube 관측 분석"
      }
    >
      {gameId && (
        <Link className="back-button" to={"/games/" + gameId}>
          ← 게임 상세
        </Link>
      )}
      <div className="service-chart-grid">
        <Unavailable
          title="일별 신규 영상 · 댓글 · 조회 증가량"
          reason="게시 시각과 발견 시각의 신규 기준 및 연결 정책을 확정한 항목만 제공합니다."
        />
        <Unavailable
          title="최근 관측 영상 목록"
          reason="게임 관련성·영상 메타데이터 조회 연결이 준비되지 않았습니다."
        />
      </div>
      <form className="game-filters" onSubmit={submit}>
        <label>
          영상 ID
          <input
            aria-label="YouTube 영상 ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            pattern="[A-Za-z0-9_-]{11}"
            minLength={11}
            maxLength={11}
            required
          />
        </label>
        <label>
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
              setDays(Number(e.target.value));
            }}
          >
            <option value="7">7일</option>
            <option value="30">30일</option>
          </select>
        </label>
        <button className="primary-action">실제 영상 관측 조회</button>
      </form>
      <StatePanel
        loading={Boolean(applied && videos.loading)}
        error={videos.error}
        retry={videos.retry}
      />
      {videos.data && (
        <>
          <ObservedChart
            title="10 · 영상 최초·마지막 누적 조회수"
            unit="회"
            points={videos.data.observations.map((v) => ({
              at: v.slot,
              value: v.views,
            }))}
          />
          <p className="chart-caption">
            최초 {number(videos.data.comparison.first?.views)} → 마지막{" "}
            {number(videos.data.comparison.last?.views)} · 차이{" "}
            {number(videos.data.comparison.cumulativeDifference)} · 실제 간격{" "}
            {number(videos.data.comparison.elapsedSeconds)}초 · 게임 관련성을
            뜻하지 않습니다.
          </p>
        </>
      )}
      <StatePanel
        loading={Boolean(appId && links.loading)}
        error={
          links.error instanceof ApiError && links.error.status === 404
            ? undefined
            : links.error
        }
        retry={links.retry}
      />
      {links.data ? (
        <Bars
          title="11 · 검색어 연결 영상과 비교 가능한 영상"
          values={links.data.content.flatMap((v) => [
            { label: v.appId + " 연결", value: v.queryAssociatedVideos },
            { label: v.appId + " 비교 가능", value: v.comparableVideos },
          ])}
          note="query 연결 근거 · 게임 관련성 미검증. 같은 영상의 서로 다른 유효 관측 슬롯이 2개 이상일 때만 비교 가능합니다."
        />
      ) : (
        <Unavailable
          title="11 · 게임별 연결 영상과 비교 가능한 영상"
          reason="승인된 게임-영상 연결이 없습니다."
        />
      )}
      <Unavailable
        title="12 · 조회 증가 가속도 계산 가능 비율"
        reason="관측 간격·최소 표본 정책 확정 전입니다. 0%를 뜻하지 않습니다."
      />
    </Frame>
  );
}
