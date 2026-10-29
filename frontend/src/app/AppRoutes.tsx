import { useLayoutEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "../layouts/AppShell";
import { DemoPlaceholderPage } from "../pages/DemoPlaceholderPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { YoutubeConnectionCompletePage } from "../pages/youtube/YoutubeConnectionCompletePage";
import { YoutubeConnectionPage } from "../pages/youtube/YoutubeConnectionPage";
import { CollectionStatusPage } from "../pages/projects/CollectionStatusPage";
import { CommentAnalysisPage } from "../pages/projects/CommentAnalysisPage";
import { ProjectCreationPage } from "../pages/projects/ProjectCreationPage";
import { ProjectDashboardPage } from "../pages/projects/ProjectDashboardPage";
import { ProjectTrendPage } from "../pages/projects/ProjectTrendPage";
import { EvidenceQualityPage } from "../pages/projects/EvidenceQualityPage";
import { EvidenceDetailPage } from "../pages/projects/EvidenceDetailPage";
import { IssueManagementPage } from "../pages/projects/IssueManagementPage";
import { AIWorkspaceReportPage } from "../pages/projects/AIWorkspaceReportPage";
import { SingleVideoAnalysisPage } from "../pages/analysis/SingleVideoAnalysisPage";
import { ProjectDemoProvider } from "../features/project-demo/ProjectDemoProvider";
import { ReviewWorkflowProvider } from "../features/project-demo/ReviewWorkflowProvider";
import { YoutubeConsentProvider } from "../features/youtube-consent/YoutubeConsentProvider";
import { yutopiaRoutes } from "./routeDefinitions";


/**
 * URL 경로 변경 시 브라우저의 스크롤을 최상단으로 이동한다.
 * 이전 페이지의 스크롤 위치가 다음 페이지에 이어지지 않도록 한다.
 */
function RouteScrollReset() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * YOUTOPIA의 최상위 라우팅 구성을 담당한다.
 *
 * - 공통 상태 Provider를 연결한다.
 * - URL에 맞는 페이지를 선택한다.
 * - AppShell을 공유할 페이지들을 구성한다.
 *
 * 실제 API 통신과 데이터 처리 로직은 이곳에 작성하지 않는다.
 */
export function AppRoutes() {
  const placeholderRoutes = yutopiaRoutes.filter(
    (route) => !["YU-01", "YU-02", "YU-03", "YU-04", "YU-05", "YU-06", "YU-07", "YU-08", "YU-09", "YU-10", "YU-11", "YU-12"].includes(route.code),
  );

  return (
    <YoutubeConsentProvider>
      <ProjectDemoProvider>
        {/* ReviewWorkflowProvider는 프로젝트 상태를 참조하므로
          ProjectDemoProvider 내부에 배치한다. */}
        <ReviewWorkflowProvider>
          <RouteScrollReset />
          <Routes>
            {/* 로그인 페이지는 공통 사이드바 레이아웃을 사용하지 않는다. */}
            <Route element={<LoginPage />} path="/" />
            <Route element={<LoginPage />} path="/login" />
            {/* 내부 페이지는 AppShell을 공유하며 Outlet에 표시된다. */}
            <Route element={<AppShell />}>
              <Route element={<YoutubeConnectionPage />} path="/connect/youtube" />
              <Route element={<YoutubeConnectionCompletePage />} path="/connect/youtube/complete" />
              <Route element={<ProjectCreationPage />} path="/projects/new" />
              <Route element={<CollectionStatusPage />} path="/projects/:projectId/collection" />
              <Route element={<ProjectDashboardPage />} path="/projects/:projectId/overview" />
              <Route element={<CommentAnalysisPage />} path="/projects/:projectId/comments" />
              <Route element={<ProjectTrendPage />} path="/projects/:projectId/trends" />
              <Route element={<EvidenceQualityPage />} path="/projects/:projectId/evidence" />
              <Route element={<EvidenceDetailPage />} path="/projects/:projectId/evidence/:claimId" />
              <Route element={<EvidenceDetailPage />} path="/projects/:projectId/evidence-detail" />
              <Route element={<IssueManagementPage />} path="/projects/:projectId/issues" />
              <Route element={<AIWorkspaceReportPage />} path="/projects/:projectId/ai-report" />

              {/* 프로젝트 생성 없이 진입할 수 있는 단일 YouTube 영상 분석 화면 */}
              <Route
                  element={<SingleVideoAnalysisPage />}
                  path="/analysis/youtube/video/:videoId"
              />
              
              {/* 별도 구현 화면이 없는 등록 경로는 임시 화면으로 표시한다. */}
              {placeholderRoutes.map((route) => (
                <Route
                  element={<DemoPlaceholderPage route={route} />}
                  key={route.code}
                  path={route.path}
                />
              ))}
            </Route>
            {/* 등록되지 않은 URL은 404 페이지를 표시한다. */}
            <Route element={<NotFoundPage />} path="*" />
          </Routes>
        </ReviewWorkflowProvider>
      </ProjectDemoProvider>
    </YoutubeConsentProvider>
  );
}
