import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </BrowserRouter>
  );
}
