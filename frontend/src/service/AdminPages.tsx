import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { serviceApi } from "./api";
import { Frame, StatePanel, useResource, number, time } from "./components";
import { InsightMetricGrid } from "../features/project-insights/InsightMetricGrid";
function Table({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <section className="source-cohort-ledger game-table-wrap">
      <h2>{title}</h2>
      {rows.length ? (
        <table className="game-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="chart-caption">집계 데이터 없음</p>
      )}
    </section>
  );
}
type Member = {
  userId: string;
  maskedEmail: string;
  accountStatus: string;
  createdAt: string;
  recoverUntil: string | null;
};
type Usage = {
  from: string;
  to: string;
  aggregationTimezone: string;
  activeSessionLabel: string;
  activeSessions: number | null;
  activeSessionAsOf: string;
  signupHistoryCoverage: string;
  newReturningDefinition: string;
  activeUsers: { dau: number | null; wau: number | null; mau: number | null };
  signupWindows: { today: number; last7KstDays: number; last30KstDays: number };
  daily: {
    dayKst: string;
    loginUsers: number;
    sessions: number;
    pageViews: number;
    searches: number;
    zeroResultSearches: number;
    zeroResultRatio: number | null;
    eventsPerSession: number | null;
  }[];
  routes: {
    dayKst: string;
    routeKey: string;
    pageViews: number;
    loginUsers: number;
    sessions: number;
  }[];
  games: {
    dayKst: string;
    appId: number;
    views: number;
    loginUsers: number;
    sessions: number;
  }[];
  actions: {
    dayKst: string;
    eventType: string;
    sortKey: string;
    direction: string;
    filterKey: string;
    count: number;
  }[];
  searchConversion: {
    dayKst: string;
    searchedContexts: number;
    selectedContexts: number;
    ratio: number | null;
  }[];
  observedVisitors: {
    dayKst: string;
    newlyObserved: number;
    returningObserved: number;
  }[];
};
export function AdminDashboard() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const resource = useResource(params.toString(), (s) =>
    serviceApi.request<Usage>("/api/v1/admin/usage?" + params, { signal: s }),
  );
  const data = resource.data;
  return (
    <Frame title="관리자 · 서비스 이용 현황">
      <div className="game-filters">
        <label>
          시작일 (KST)
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          종료일 (KST)
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <Link className="primary-action" to="/admin/users">
          회원 조회
        </Link>
      </div>
      <StatePanel
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
      />
      {data && (
        <>
          <p className="chart-caption">
            {data.from}~{data.to} · {data.aggregationTimezone} ·{" "}
            이전 기간은 보존 중인 회원의 가입 이력 범위입니다.
          </p>
          <InsightMetricGrid
            metrics={[
              {
                label: data.activeSessionLabel,
                value: number(data.activeSessions),
                note: time(data.activeSessionAsOf),
              },
              {
                label: "DAU / WAU / MAU",
                value: [
                  data.activeUsers.dau,
                  data.activeUsers.wau,
                  data.activeUsers.mau,
                ]
                  .map(number)
                  .join(" / "),
                note: "로그인 고유 이용자",
              },
              {
                label: "신규 가입자 오늘 / 7일 / 30일",
                value: [
                  data.signupWindows.today,
                  data.signupWindows.last7KstDays,
                  data.signupWindows.last30KstDays,
                ]
                  .map(number)
                  .join(" / "),
                note: "가입 집계 · 잔존 회원 수와 구분",
              },
            ]}
          />
          <Table
            title="일별 사용량"
            columns={[
              "일자",
              "로그인 고유",
              "방문 세션",
              "페이지뷰",
              "검색",
              "검색 0건",
              "0건 비율",
              "세션당 활동",
            ]}
            rows={data.daily.map((v) => [
              v.dayKst,
              number(v.loginUsers),
              number(v.sessions),
              number(v.pageViews),
              number(v.searches),
              number(v.zeroResultSearches),
              number(v.zeroResultRatio),
              number(v.eventsPerSession),
            ])}
          />
          <Table
            title="페이지별 조회"
            columns={["일자", "페이지", "조회", "로그인 고유", "세션"]}
            rows={data.routes.map((v) => [
              v.dayKst,
              v.routeKey,
              number(v.pageViews),
              number(v.loginUsers),
              number(v.sessions),
            ])}
          />
          <Table
            title="게임별 조회"
            columns={["일자", "Steam ID", "조회", "로그인 고유", "세션"]}
            rows={data.games.map((v) => [
              v.dayKst,
              v.appId,
              v.views,
              v.loginUsers,
              v.sessions,
            ])}
          />
          <Table
            title="검색→상세 전환"
            columns={["일자", "검색 문맥", "선택 문맥", "전환 비율"]}
            rows={data.searchConversion.map((v) => [
              v.dayKst,
              v.searchedContexts,
              v.selectedContexts,
              number(v.ratio),
            ])}
          />
          <Table
            title="정렬·필터·분석 이용"
            columns={["일자", "행동", "정렬", "방향", "필터", "횟수"]}
            rows={data.actions.map((v) => [
              v.dayKst,
              v.eventType,
              v.sortKey,
              v.direction,
              v.filterKey,
              v.count,
            ])}
          />
          <Table
            title="신규·재방문 관측"
            columns={["일자", "신규 관측", "재방문 관측"]}
            rows={data.observedVisitors.map((v) => [
              v.dayKst,
              v.newlyObserved,
              v.returningObserved,
            ])}
          />
          <p className="chart-caption">
            보존 중인 행동 이력의 최초 관측일로 구분하며 생애 최초 방문을 뜻하지 않습니다. · 관리자 화면 조회는 방문 활동을
            생성하지 않습니다.
          </p>
        </>
      )}
    </Frame>
  );
}
export function AdminMembers() {
  const [page, setPage] = useState(0),
    [status, setStatus] = useState("ACTIVE"),
    [q, setQ] = useState("");
  const resource = useResource(page + ":" + status + ":" + q, (s) =>
    serviceApi.request<{
      content: Member[];
      page: { number: number; hasNext: boolean };
    }>(
      "/api/v1/admin/members?" +
        new URLSearchParams({ page: String(page), status, q }),
      { signal: s },
    ),
  );
  return (
    <Frame title="관리자 · 회원 조회">
      <div className="game-filters">
        <label>
          계정 상태
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="ACTIVE">활성 회원</option>
            <option value="PENDING_DELETION">탈퇴 대기</option>
          </select>
        </label>
        <label>
          회원 검색
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            maxLength={100}
          />
        </label>
        <Link className="back-button" to="/admin">
          운영 현황
        </Link>
      </div>
      <StatePanel
        loading={resource.loading}
        error={resource.error}
        empty={resource.data?.content.length === 0}
        retry={resource.retry}
      />
      {resource.data && (
        <>
          <Table
            title="마스킹된 회원 정보"
            columns={["내부 ID", "마스킹 이메일", "상태", "가입", "복구 만료"]}
            rows={resource.data.content.map((v) => [
              <Link to={"/admin/users/" + v.userId}>{v.userId}</Link>,
              v.maskedEmail,
              v.accountStatus,
              time(v.createdAt),
              v.recoverUntil ? time(v.recoverUntil) : "—",
            ])}
          />
          <nav className="game-pagination">
            <button
              className="back-button"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </button>
            <span>{page + 1}</span>
            <button
              className="back-button"
              disabled={!resource.data.page.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </nav>
        </>
      )}
    </Frame>
  );
}
export function AdminMember() {
  const { id = "" } = useParams();
  const resource = useResource(id, (s) =>
    serviceApi.request<Member>(
      "/api/v1/admin/members/" + encodeURIComponent(id),
      { signal: s },
    ),
  );
  const data = resource.data;
  return (
    <Frame title="관리자 · 회원 상세">
      <Link className="back-button" to="/admin/users">
        ← 회원 목록
      </Link>
      <StatePanel
        loading={resource.loading}
        error={resource.error}
        retry={resource.retry}
      />
      {data && (
        <Table
          title="기본 조회 정보"
          columns={["항목", "값"]}
          rows={[
            ["내부 ID", data.userId],
            ["이메일", data.maskedEmail],
            ["상태", data.accountStatus],
            ["가입", time(data.createdAt)],
            ["복구 만료", data.recoverUntil ? time(data.recoverUntil) : "—"],
          ]}
        />
      )}
    </Frame>
  );
}
