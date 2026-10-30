import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "../theme/ThemeProvider";
import { AnalysisRepositoryProvider } from "../features/analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../features/analysis/data/DemoAnalysisRepository";
import { AppRoutes } from "./AppRoutes";
import { createValidatedDemoAnalysisRepository } from "../features/analysis/data/ValidatedDemoAnalysisRepository";
import { ServiceApp } from "../service/ServiceApp";

const validatedDemoAnalysisRepository = createValidatedDemoAnalysisRepository(
  demoAnalysisRepository,
);

/**
 * 웹 애플리케이션의 최상위 구성.
 *
 * - BrowserRouter: URL 라우팅
 * - ThemeProvider: 테마 상태
 * - AnalysisRepositoryProvider: 분석 데이터 공급자
 * - AppRoutes: 현재 URL에 맞는 화면
 */
function DemoApp() {
  return (
    <BrowserRouter
      basename={import.meta.env.VITE_DEMO_ONLY === "true" ? undefined : "/demo"}
    >
      <ThemeProvider>
        <AnalysisRepositoryProvider
          repository={validatedDemoAnalysisRepository}
        >
          <AppRoutes />
        </AnalysisRepositoryProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
export function App() {
  return import.meta.env.VITE_DEMO_ONLY === "true" ||
    /^\/demo(?:\/|$)/.test(window.location.pathname) ? (
    <DemoApp />
  ) : (
    <ServiceApp />
  );
}
