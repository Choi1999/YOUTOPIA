import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Metric, Publications } from "./api";
import { GameAvailabilityBadges, SteamObservationSummary, YoutubeObservationSummary } from "./ObservationSummary";

const observedAt = "2026-11-27T00:00:00Z";
const metric = (value: number | null, availability = "AVAILABLE", at: string | null = observedAt): Metric =>
  ({ value, availability, observedAt: at });
const publications: Publications = {
  appId: 570, days: 7, asOf: observedAt, timezone: "Asia/Seoul", dataStatus: "AVAILABLE", coverage: "UNASSESSED",
  missingPublishedAt: 2, selectedDate: null, videoScope: "period", points: [],
  videos: { content: [], page: { number: 0, size: 20, totalElements: 3, hasNext: false } },
  summary: { population: "QUERY_ASSOCIATED_DISTINCT_VIDEOS_DISCOVERED_BY_AS_OF", observedVideos: 12,
    publishedVideos: 9, periodVideos: 3, missingPublishedAt: 2, futurePublishedAt: 1, latestFirstObservedAt: observedAt },
};

function card(label: string) {
  const article = screen.getByText(label).closest("article");
  expect(article).not.toBeNull();
  return within(article!);
}

describe("Steam observation summary", () => {
  it("preserves an observed zero with its timestamp and separates an unavailable peak", () => {
    render(<SteamObservationSummary game={{ currentCcu: metric(0), peak24h: metric(null, "UNAVAILABLE", null), reviewAvailability: "UNAVAILABLE" }} />);
    expect(card("현재 CCU").getByText("0명")).toBeVisible();
    expect(card("현재 CCU").getByText(/KST/)).toBeVisible();
    expect(card("24시간 최고 CCU").getByText("데이터 미지원")).toBeVisible();
    expect(card("Steam 리뷰").getByText("데이터 미지원")).toBeVisible();
  });

  it.each([metric(null), metric(0, "AVAILABLE", null), metric(-1), metric(Number.NaN)])(
    "does not render malformed observations as numeric values: %j", (currentCcu) => {
      render(<SteamObservationSummary game={{ currentCcu, peak24h: metric(null, "EMPTY", null) }} />);
      expect(card("현재 CCU").getByText("관측 정보 미확인")).toBeVisible();
      expect(card("24시간 최고 CCU").getByText("확인된 결과 없음")).toBeVisible();
      expect(screen.queryByText("0명")).toBeNull();
    },
  );
});

describe("dashboard availability", () => {
  it("preserves unsupported, denied and unknown states without claiming counts", () => {
    render(<GameAvailabilityBadges game={{ reviewAvailability: "UNAVAILABLE", analysisAvailability: "PERMISSION_UNCONFIRMED" }} />);
    const badges = screen.getByLabelText("추가 관측 가용성");
    expect(badges).toHaveTextContent("댓글·텍스트 분석: 조회 권한 미확인");
    expect(badges).toHaveTextContent("Steam 리뷰: 데이터 미지원");
    expect(badges).toHaveTextContent("최근 게임 이벤트: 상태 미확인");
    expect(badges).not.toHaveTextContent(/0개|0건/);
  });
});

describe("YouTube observation summary", () => {
  it("uses the server period and cohort, keeping unknown coverage and exclusions visible", () => {
    render(<YoutubeObservationSummary data={publications} days={7} />);
    expect(card("최근 7일 게시 관측 영상").getByText("3개")).toBeVisible();
    expect(card("누적 연결 관측 영상").getByText("12개")).toBeVisible();
    expect(screen.getByText(/게시 시각 누락 2개, 미래 게시 시각 1개/)).toBeVisible();
    expect(screen.getByText(/수집 범위 완전성은 미확인/)).toBeVisible();
    expect(screen.getByText(/발견 시각은 수집 최신성 판정과 다릅니다/)).toBeVisible();
    expect(card("조회 증가량").getByText("데이터 미지원")).toBeVisible();
    expect(card("댓글 관측").getByText("데이터 미지원")).toBeVisible();
  });

  it("keeps a confirmed zero for the selected period separate from historical observations", () => {
    render(<YoutubeObservationSummary data={{ ...publications, dataStatus: "EMPTY", summary: { ...publications.summary!, periodVideos: 0 } }} days={7} />);
    expect(card("최근 7일 게시 관측 영상").getByText("0개")).toBeVisible();
    expect(card("누적 연결 관측 영상").getByText("12개")).toBeVisible();
  });

  it("does not reuse a thirty-day summary during a seven-day request", () => {
    render(<YoutubeObservationSummary data={{ ...publications, days: 30 }} days={7} />);
    expect(card("최근 7일 게시 관측 영상").getByText("선택 기간 확인 중")).toBeVisible();
    expect(screen.queryByText("3개")).toBeNull();
    expect(screen.queryByText("12개")).toBeNull();
  });

  it.each(["PENDING_CONTRACT", "PERMISSION_UNCONFIRMED", "ERROR", "UNAVAILABLE"])(
    "never turns %s into a zero or substitutes stale summary counts", (dataStatus) => {
      render(<YoutubeObservationSummary data={{ ...publications, dataStatus }} days={7} />);
      expect(screen.queryByText("0개")).toBeNull();
      expect(screen.queryByText("3개")).toBeNull();
      expect(screen.queryByText("12개")).toBeNull();
    },
  );

  it("keeps older server responses and the initial request distinguishable from zero", () => {
    const view = render(<YoutubeObservationSummary days={7} />);
    expect(card("최근 7일 게시 관측 영상").getByText("확인 중")).toBeVisible();
    view.rerender(<YoutubeObservationSummary data={{ ...publications, summary: undefined }} days={7} />);
    expect(card("최근 7일 게시 관측 영상").getByText("요약 미제공")).toBeVisible();
    expect(screen.queryByText("0개")).toBeNull();
  });

  it("rejects inconsistent population counts without concealing the uncertainty", () => {
    render(<YoutubeObservationSummary data={{ ...publications, summary: { ...publications.summary!, observedVideos: 2 } }} days={7} />);
    expect(card("누적 연결 관측 영상").getByText("요약 정보 미확인")).toBeVisible();
    expect(screen.queryByText("2개")).toBeNull();
  });
});
