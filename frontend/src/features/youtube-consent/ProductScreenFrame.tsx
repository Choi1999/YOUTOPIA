import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

import { ThemeSelector } from "../../theme/ThemeSelector";
import { useTheme } from "../../theme/ThemeProvider";

export function ProductScreenFrame({
  children,
  title,
  service=false,
  actions,
}: {
  children: ReactNode;
  title: string;
  service?:boolean;
  actions?:ReactNode;
}) {
  const navigate = useNavigate();
  const { resolvedTheme:theme } = useTheme();

  return (
    <div className={"product-screen"+(service?" service-screen":"")}>
      <header className="product-toolbar">
        <button className="back-button" onClick={() => navigate(-1)} type="button">
          ← 이전 단계
        </button>
        <div className="toolbar-actions">
          <ThemeSelector />
          {actions}
          <span className="demo-mode-badge">
            {service?"관측 데이터":"DEMO"} · {theme === "dark" ? "Dark" : "Light"}
          </span>
        </div>
      </header>

      <section className="product-heading">
        <h1>{title}</h1>
        <p>{service?"YUTOPIA · 게임 트렌드 / Steam · YouTube 관측":"YUTOPIA · NEXUS 시즌2 / YouTube 관측 프로젝트 (콘셉트)"}</p>
      </section>

      {children}

      <footer className="demo-disclosure">
        {service?"실제 관측값만 표시합니다. 데이터 미지원과 관측값 0을 구분해 확인해 주세요.":"DEMO / SIMULATED · 실제 인증과 API 실행을 수행하지 않는 UI 시안 · 일부 분석 기능은 정책 승인 조건부"}
      </footer>
    </div>
  );
}
