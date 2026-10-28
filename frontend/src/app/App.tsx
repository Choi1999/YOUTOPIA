import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";

/**
 * 앱의 최상위 구성: 라우팅과 테마를 하위 페이지에 제공한다.
 * 실제 페이지 선택은 AppRoutes에 맡기며 데이터 조회는 이곳에서 수행하지 않는다.
 */
export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </BrowserRouter>
  );
}
