export type CollectionStatus = "QUEUED" | "RUNNING" | "PARTIAL" | "FAILED" | "SUCCEEDED";

export const DEMO_OBSERVATION_WINDOW = {
  start: "2025-03-01",
  end: "2025-04-08",
} as const;

export const DEMO_COMPARISON_WINDOWS = {
  before: { start: "2025-03-11", end: "2025-03-24" },
  after: { start: "2025-03-25", end: "2025-04-07" },
} as const;

export const DEMO_COLLECTION_TOTALS = {
  selectedVideos: 3,
  rawComments: 12_842,
  eligibleComments: 10_204,
  excludedComments: 2_638,
  classifiedComments: 8_421,
  unclassifiedEligibleComments: 1_783,
  reviewCandidates: 28,
} as const;

export const DEMO_SOURCE = {
  name: "NEXUS 공식 YouTube 채널",
  attribution: "공개 영상 3개 · YUTOPIA 고정 DEMO fixture",
  observedAt: "2025-04-08 09:05 KST",
  availability: "SIMULATED / 로컬 고정 데이터",
} as const;

export type DemoSourceVideo = {
  id: string;
  title: string;
  publishedAt: string;
  detail: string;
};

export const DEMO_SOURCE_VIDEOS: DemoSourceVideo[] = [
  {
    id: "update-trailer-0318",
    title: "업데이트 트레일러",
    publishedAt: "2025-03-18",
    detail: "NEXUS 공식 채널 · 분석 대상",
  },
  {
    id: "patch-notes-0324",
    title: "패치노트 설명",
    publishedAt: "2025-03-24",
    detail: "NEXUS 공식 채널 · 분석 대상",
  },
  {
    id: "developer-live-0325",
    title: "개발자 라이브",
    publishedAt: "2025-03-25",
    detail: "NEXUS 공식 채널 · 분석 대상",
  },
];

export const DEMO_COLLECTION_METRICS: Record<
  CollectionStatus,
  { raw: number | null; eligible: number | null; excluded: number | null; timestamp: string }
> = {
  QUEUED: { raw: null, eligible: null, excluded: null, timestamp: "2025-04-08 09:00 KST" },
  RUNNING: { raw: 4_280, eligible: 3_200, excluded: 1_080, timestamp: "2025-04-08 09:01 KST" },
  PARTIAL: { raw: 8_420, eligible: 6_510, excluded: 1_910, timestamp: "2025-04-08 09:03 KST" },
  FAILED: { raw: null, eligible: null, excluded: null, timestamp: "2025-04-08 09:04 KST" },
  SUCCEEDED: {
    raw: DEMO_COLLECTION_TOTALS.rawComments,
    eligible: DEMO_COLLECTION_TOTALS.eligibleComments,
    excluded: DEMO_COLLECTION_TOTALS.excludedComments,
    timestamp: DEMO_SOURCE.observedAt,
  },
};

const dailyCounts = [
  86, 97, 102, 112, 121, 129, 140, 151, 159, 169, 179, 190, 199,
  211, 222, 233, 245, 255, 267, 280, 294, 308, 323, 337, 351, 373,
  394, 423, 452, 488, 531, 588, 545, 495, 624, 660, 617, 703, 789,
] as const;

function enumerateDates(start: string, length: number) {
  const cursor = new Date(`${start}T00:00:00Z`);
  return Array.from({ length }, (_, index) => {
    const date = new Date(cursor);
    date.setUTCDate(cursor.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export const DEMO_DAILY_OBSERVATIONS = enumerateDates(
  DEMO_OBSERVATION_WINDOW.start,
  dailyCounts.length,
).map((date, index) => ({ date, rawComments: dailyCounts[index] }));

export type SentimentId = "positive" | "neutral" | "negative" | "unclassified";

export const DEMO_SENTIMENT_DISTRIBUTION: Array<{
  id: SentimentId;
  label: string;
  count: number;
  tone: "positive" | "neutral" | "negative" | "unclassified";
}> = [
  { id: "positive", label: "긍정", count: 4_884, tone: "positive" },
  { id: "neutral", label: "중립", count: 2_021, tone: "neutral" },
  { id: "negative", label: "부정", count: 1_516, tone: "negative" },
  { id: "unclassified", label: "기타/미분류", count: 1_783, tone: "unclassified" },
];

export type DemoIssueId = "PERF-001" | "PAY-002" | "STAB-005" | "BAL-003" | "CONT-004";

export type DemoRepresentativeComment = {
  id: string;
  issueId: DemoIssueId;
  sentiment: SentimentId;
  text: string;
  videoId: string;
  observedAt: string;
};

export type DemoIssue = {
  id: DemoIssueId;
  category: string;
  count: number;
  state: "OBSERVED" | "HOLD" | "CANDIDATE";
  summary: string;
  interpretation: string;
  evidencePath: string;
};

export const DEMO_ISSUES: DemoIssue[] = [
  {
    id: "PERF-001",
    category: "성능 저하",
    count: 1_284,
    state: "OBSERVED",
    summary: "패치 이후 일부 댓글에서 프레임 저하 호소 관측",
    interpretation: "댓글 표현이 관측되었다는 후보이며 실제 게임 결함을 확정하지 않습니다.",
    evidencePath: "/projects/nexus-season-2/evidence/PERF-001",
  },
  {
    id: "PAY-002",
    category: "과금/가격",
    count: 892,
    state: "HOLD",
    summary: "과금 불만 급증 주장 · 비교 근거 미달",
    interpretation: "증가를 검증할 비교 기준이 부족하므로 HOLD이며 급증을 주장하지 않습니다.",
    evidencePath: "/projects/nexus-season-2/evidence?issue=PAY-002",
  },
  {
    id: "STAB-005",
    category: "안정성",
    count: 621,
    state: "CANDIDATE",
    summary: "로딩과 접속 안정성 관련 표현 후보",
    interpretation: "합성 댓글에서 찾은 다중 라벨 후보로, 장애 발생을 의미하지 않습니다.",
    evidencePath: "/projects/nexus-season-2/evidence?issue=STAB-005",
  },
  {
    id: "BAL-003",
    category: "밸런스",
    count: 498,
    state: "CANDIDATE",
    summary: "캐릭터 밸런스 논쟁 후보",
    interpretation: "상반된 의견을 묶은 데모 분류이며 우열이나 패치 효과를 확정하지 않습니다.",
    evidencePath: "/projects/nexus-season-2/evidence?issue=BAL-003",
  },
  {
    id: "CONT-004",
    category: "콘텐츠",
    count: 436,
    state: "CANDIDATE",
    summary: "신규 콘텐츠 요청 후보",
    interpretation: "요청 표현의 데모 분류이며 실제 수요 규모를 나타내지 않습니다.",
    evidencePath: "/projects/nexus-season-2/evidence?issue=CONT-004",
  },
];

export const DEMO_REPRESENTATIVE_COMMENTS: DemoRepresentativeComment[] = [
  {
    id: "SYN-PERF-01",
    issueId: "PERF-001",
    sentiment: "negative",
    text: "업데이트 뒤 특정 전투 장면에서 프레임이 끊기는 느낌이 있어요.",
    videoId: "developer-live-0325",
    observedAt: "2025-03-26",
  },
  {
    id: "SYN-PERF-02",
    issueId: "PERF-001",
    sentiment: "neutral",
    text: "같은 구간을 다시 확인할 수 있도록 설정과 장면 정보가 더 필요해 보여요.",
    videoId: "patch-notes-0324",
    observedAt: "2025-03-27",
  },
  {
    id: "SYN-PAY-01",
    issueId: "PAY-002",
    sentiment: "negative",
    text: "새 상품 가격 구성이 부담스럽게 느껴지지만 이전 시즌과 단순 비교하기는 어렵네요.",
    videoId: "update-trailer-0318",
    observedAt: "2025-03-25",
  },
  {
    id: "SYN-STAB-01",
    issueId: "STAB-005",
    sentiment: "negative",
    text: "첫 접속에서 로딩이 길었지만 재접속 뒤에는 정상적으로 들어갔어요.",
    videoId: "developer-live-0325",
    observedAt: "2025-03-28",
  },
  {
    id: "SYN-BAL-01",
    issueId: "BAL-003",
    sentiment: "neutral",
    text: "새 캐릭터 조합은 재미있지만 대전 표본을 더 본 뒤 판단하고 싶어요.",
    videoId: "patch-notes-0324",
    observedAt: "2025-03-30",
  },
  {
    id: "SYN-CONT-01",
    issueId: "CONT-004",
    sentiment: "positive",
    text: "다음 시즌에는 협동 콘텐츠가 더 추가되면 좋겠어요.",
    videoId: "update-trailer-0318",
    observedAt: "2025-04-02",
  },
];

export type DashboardDataState =
  | "loading"
  | "empty"
  | "partial"
  | "failed"
  | "stale"
  | "unavailable"
  | "success";

export function deriveDashboardDataState(
  hasProject: boolean,
  collectionStatus: CollectionStatus | null,
  override: "AUTO" | "EMPTY" | "STALE" | "UNAVAILABLE" = "AUTO",
): DashboardDataState {
  if (!hasProject || !collectionStatus || override === "UNAVAILABLE") return "unavailable";
  if (collectionStatus === "QUEUED" || collectionStatus === "RUNNING") return "loading";
  if (collectionStatus === "PARTIAL") return "partial";
  if (collectionStatus === "FAILED") return "failed";
  if (override === "EMPTY") return "empty";
  if (override === "STALE") return "stale";
  return "success";
}
