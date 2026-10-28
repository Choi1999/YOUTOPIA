import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./theme/tokens.css";
import "./style.css";
import "./app-shell.css";

// index.html의 #root를 찾는다. 양쪽 ID가 일치해야 앱을 연결할 수 있다.
const rootElement = document.getElementById("root");

// 진입 컨테이너가 없으면 잘못된 HTML 구성을 숨기지 않고 중단한다.
if (!rootElement) {
  throw new Error("Root element was not found.");
}

// createRoot는 HTML 요소를 새로 만들지 않고 기존 DOM 요소를 React 관리 대상으로 등록한다.
// StrictMode는 개발 중 잠재적인 React 코드 문제를 드러내도록 돕는다.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
