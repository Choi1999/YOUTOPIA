// StrictMode는 개발 중 잠재적인 React 코드 문제를 찾도록 돕는다.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./theme/tokens.css";
import "./style.css";
import "./app-shell.css";

// index.html에 선언된 root 요소를 찾는다.
// HTML의 ID를 변경하면 이 검색 ID도 함께 변경해야 한다.
const rootElement = document.getElementById("root");

// React를 연결할 컨테이너가 없으면 실행을 중단한다.
if (!rootElement) {
  throw new Error("Root element was not found.");
}

// 기존 HTML 요소를 React의 관리 대상으로 등록하고
// App 컴포넌트를 최상위 화면으로 렌더링한다.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
