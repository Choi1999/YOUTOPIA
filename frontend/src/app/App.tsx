
import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "../theme/ThemeProvider";
import { AnalysisRepositoryProvider } from "../features/analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../features/analysis/data/DemoAnalysisRepository";
import { AppRoutes } from "./AppRoutes";

/**
 * 웹 애플리케이션의 최상위 구성.
 *
 * - BrowserRouter: URL 라우팅
 * - ThemeProvider: 테마 상태
 * - AnalysisRepositoryProvider: 분석 데이터 공급자
 * - AppRoutes: 현재 URL에 맞는 화면
 */
export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
          <AppRoutes />
        </AnalysisRepositoryProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
