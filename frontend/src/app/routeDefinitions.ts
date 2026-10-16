export const DEMO_PROJECT_ID = "nexus-season-2";

export type YutopiaRouteDefinition = {
  code: `YU-${string}`;
  path: string;
  href: string;
  title: string;
  summary: string;
};

export const yutopiaRoutes: YutopiaRouteDefinition[] = [
  { code: "YU-01", path: "/login", href: "/login", title: "로그인", summary: "기존 브라우저 데모 로그인" },
  { code: "YU-02", path: "/connect/youtube", href: "/connect/youtube", title: "YouTube 채널 연결 · 권한 요청", summary: "실제 OAuth 없는 로컬 권한 상태 시뮬레이션" },
  { code: "YU-03", path: "/connect/youtube/complete", href: "/connect/youtube/complete", title: "채널 권한 승인 완료", summary: "승인·만료·직접 진입 차단 로컬 시뮬레이션" },
  { code: "YU-04", path: "/projects/new", href: "/projects/new", title: "관측 프로젝트 생성", summary: "NEXUS 시즌2 인메모리 프로젝트 생성 시뮬레이션" },
  { code: "YU-05", path: "/projects/:projectId/collection", href: `/projects/${DEMO_PROJECT_ID}/collection`, title: "수집 진행 · 완료 상태", summary: "외부 요청 없는 결정적 수집 상태 시뮬레이션" },
  { code: "YU-06", path: "/projects/:projectId/overview", href: `/projects/${DEMO_PROJECT_ID}/overview`, title: "프로젝트 대시보드", summary: "수집 상태와 출처를 보존하는 결정적 데모 대시보드" },
  { code: "YU-07", path: "/projects/:projectId/comments", href: `/projects/${DEMO_PROJECT_ID}/comments`, title: "댓글 감성 · 이슈 분석", summary: "합성 댓글과 고정 분류를 사용하는 로컬 분석 시뮬레이션" },
  { code: "YU-08", path: "/projects/:projectId/trends", href: `/projects/${DEMO_PROJECT_ID}/trends`, title: "트렌드 관측 · 패치 전후 비교", summary: "39일 고정 fixture에서 파생하는 조건부 비교 시뮬레이션" },
  { code: "YU-09", path: "/projects/:projectId/evidence", href: `/projects/${DEMO_PROJECT_ID}/evidence`, title: "근거 및 데이터 품질 검증", summary: "합성 근거의 계보와 주장 차단을 검토하는 로컬 시뮬레이션" },
  { code: "YU-10", path: "/projects/:projectId/evidence/:claimId", href: `/projects/${DEMO_PROJECT_ID}/evidence/PERF-001`, title: "PERF-001 · 근거 상세 검토", summary: "합성 근거의 가용성과 검토 한계를 확인하는 인메모리 시뮬레이션" },
  { code: "YU-11", path: "/projects/:projectId/issues", href: `/projects/${DEMO_PROJECT_ID}/issues`, title: "이슈 관리 · 담당자 검토", summary: "허용 전이와 감사 기록을 사용하는 인메모리 Kanban 시뮬레이션" },
  { code: "YU-12", path: "/projects/:projectId/ai-report", href: `/projects/${DEMO_PROJECT_ID}/ai-report`, title: "AI 워크스페이스 · 보고서 공유", summary: "마스킹 근거와 보고서 초안을 사용하는 로컬 시뮬레이션" },
];

export function getRoute(code: YutopiaRouteDefinition["code"]) {
  const route = yutopiaRoutes.find((candidate) => candidate.code === code);
  if (!route) throw new Error(`Unknown YUTOPIA route: ${code}`);
  return route;
}
