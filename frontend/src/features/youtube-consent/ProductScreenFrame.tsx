import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

import { ThemeSelector } from "../../theme/ThemeSelector";
import { useTheme } from "../../theme/ThemeProvider";

export function ProductScreenFrame({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className="product-screen">
      <header className="product-toolbar">
        <button className="back-button" onClick={() => navigate(-1)} type="button">
          ← 이전 단계
        </button>
        <div className="toolbar-actions">
          <ThemeSelector />
          <span className="demo-mode-badge">
            DEMO · {theme === "dark" ? "Dark" : "Light"}
          </span>
        </div>
      </header>

      <section className="product-heading">
        <h1>{title}</h1>
        <p>YUTOPIA · NEXUS 시즌2 / YouTube 관측 프로젝트 (콘셉트)</p>
      </section>

      {children}

      <footer className="demo-disclosure">
        DEMO / SIMULATED · 실제 인증과 API 실행을 수행하지 않는 UI 시안 · 일부 분석 기능은 정책 승인 조건부
      </footer>
    </div>
  );
}
