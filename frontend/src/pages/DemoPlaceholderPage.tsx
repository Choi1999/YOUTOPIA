import { useNavigate } from "react-router-dom";

import type { YutopiaRouteDefinition } from "../app/routeDefinitions";
import { ThemeSelector } from "../theme/ThemeSelector";
import { useTheme } from "../theme/ThemeProvider";

export function DemoPlaceholderPage({ route }: { route: YutopiaRouteDefinition }) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className="placeholder-page">
      <header className="placeholder-toolbar">
        <button className="back-button" onClick={() => navigate(-1)} type="button">
          ← 이전 단계
        </button>
        <div className="toolbar-actions">
          <ThemeSelector />
          <span className="demo-mode-badge">DEMO · {theme === "dark" ? "Dark" : "Light"}</span>
        </div>
      </header>

      <section className="placeholder-heading">
        <p className="route-code">{route.code}</p>
        <h1>{route.title}</h1>
        <p>{route.summary}</p>
      </section>

      <section aria-labelledby="foundation-status" className="placeholder-card">
        <span className="status-pill">DEMO / NOT IMPLEMENTED</span>
        <h2 id="foundation-status">P0-1 애플리케이션 기반만 연결되었습니다.</h2>
        <p>
          이 경로는 공통 AppShell, 내비게이션, 테마와 라우팅을 검증하기 위한 자리표시자입니다.
          화면의 실제 데이터와 완료 상태를 나타내지 않습니다.
        </p>
        <ul>
          <li>OAuth 또는 외부 계정 연결 없음</li>
          <li>YouTube API, 백엔드, 데이터 수집 없음</li>
          <li>감성 추론, LLM, MCP 호출 없음</li>
        </ul>
      </section>

      <footer className="demo-disclosure">
        데모 UI · 실제 인증, API 실행, 분석 또는 보고서 공유를 수행하지 않습니다.
      </footer>
    </div>
  );
}
