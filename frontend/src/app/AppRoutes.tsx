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
import { ProjectDemoProvider } from "../features/project-demo/ProjectDemoProvider";
import { ReviewWorkflowProvider } from "../features/project-demo/ReviewWorkflowProvider";
import { YoutubeConsentProvider } from "../features/youtube-consent/YoutubeConsentProvider";
import { yutopiaRoutes } from "./routeDefinitions";

function RouteScrollReset() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export function AppRoutes() {
  const placeholderRoutes = yutopiaRoutes.filter(
    (route) => !["YU-01", "YU-02", "YU-03", "YU-04", "YU-05", "YU-06", "YU-07", "YU-08", "YU-09", "YU-10", "YU-11", "YU-12"].includes(route.code),
  );

  return (
    <YoutubeConsentProvider>
      <ProjectDemoProvider>
        <ReviewWorkflowProvider>
          <RouteScrollReset />
          <Routes>
            <Route element={<LoginPage />} path="/" />
            <Route element={<LoginPage />} path="/login" />
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
              {placeholderRoutes.map((route) => (
                <Route
                  element={<DemoPlaceholderPage route={route} />}
                  key={route.code}
                  path={route.path}
                />
              ))}
            </Route>
            <Route element={<NotFoundPage />} path="*" />
          </Routes>
        </ReviewWorkflowProvider>
      </ProjectDemoProvider>
    </YoutubeConsentProvider>
  );
}
