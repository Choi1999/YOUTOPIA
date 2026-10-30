import { useEffect, useLayoutEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { LoginPage } from "../pages/auth/LoginPage";
import { ThemeProvider } from "../theme/ThemeProvider";
import { SessionProvider, useSession } from "./SessionProvider";
import { ApiError } from "./api";
import { StatePanel } from "./components";
import { GameListPage, GameDetailPage, SteamGamePage } from "./GamePages";
import { SteamChartsPage, YoutubePage } from "./ChartPages";
import { SettingsPage } from "./SettingsPage";
import { AdminDashboard, AdminMembers, AdminMember } from "./AdminPages";
import { UserActivity } from "./Activity";
function RouteScrollReset() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function Login({
  admin = false,
  signup = false,
}: {
  admin?: boolean;
  signup?: boolean;
}) {
  const session = useSession(),
    navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    if (session.status === "authenticated") {
      const from = location.state?.from;
      const next =
        typeof from === "string" &&
        /^\/(games|charts|dashboard|settings)(\/|\?|$)/.test(from)
          ? from
          : "/dashboard";
      navigate(session.identity?.kind === "ADMIN" ? "/admin" : next, {
        replace: true,
      });
    }
  }, [session.status, session.identity?.id]);
  return (
    <>
      <LoginPage service admin={admin} signup={signup} />
      {session.status === "unavailable" && (
        <p className="service-login-status" role="alert">
          세션 상태를 확인하지 못했습니다. 서버 연결을 확인하고 다시 시도해
          주세요.
        </p>
      )}
    </>
  );
}
function Guard() {
  const session = useSession(),
    location = useLocation();
  if (session.status === "checking") return <StatePanel loading />;
  if (session.status === "unavailable")
    return (
      <StatePanel
        error={new ApiError(503, "SERVICE_UNAVAILABLE")}
        retry={() => {
          void session.refresh();
        }}
      />
    );
  if (session.status === "guest")
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (session.identity?.kind !== "USER")
    return (
      <main>
        <h1>접근 권한이 없습니다.</h1>
        <Link to="/admin">관리자 화면</Link>
      </main>
    );
  return <Outlet />;
}
function AdminGuard() {
  const session = useSession();
  if (session.status === "checking") return <StatePanel loading />;
  if (session.status === "guest") return <Navigate to="/admin/login" replace />;
  if (session.status === "unavailable")
    return (
      <StatePanel
        error={new ApiError(503, "SERVICE_UNAVAILABLE")}
        retry={() => {
          void session.refresh();
        }}
      />
    );
  if (session.identity?.kind !== "ADMIN")
    return (
      <main>
        <h1>접근 권한이 없습니다.</h1>
        <Link to="/games">게임 탐색</Link>
      </main>
    );
  return <Outlet />;
}
export function ServiceApp() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ThemeProvider>
          <UserActivity />
          <RouteScrollReset />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login signup />} />
            <Route path="/admin/login" element={<Login admin />} />
              <Route element={<AppShell service />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<GameListPage dashboard />} />
                <Route path="/games" element={<GameListPage />} />
                <Route path="/games/:gameId" element={<GameDetailPage />} />
                <Route
                  path="/games/:gameId/steam"
                  element={<SteamGamePage />}
                />
                <Route
                  path="/games/:gameId/youtube"
                  element={<YoutubePage />}
                />
                <Route path="/charts/steam" element={<SteamChartsPage />} />
                <Route path="/charts/youtube" element={<YoutubePage />} />
                <Route element={<Guard />}>
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            <Route element={<AdminGuard />}>
              <Route element={<AppShell service admin />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/members" element={<AdminMembers />} />
                <Route path="/admin/users" element={<AdminMembers />} />
                <Route path="/admin/users/:id" element={<AdminMember />} />
                <Route path="/admin/analytics" element={<AdminDashboard />} />
                <Route path="/admin/members/:id" element={<AdminMember />} />
              </Route>
            </Route>
            <Route
              path="*"
              element={
                <main>
                  <h1>페이지를 찾을 수 없습니다.</h1>
                  <Link to="/games">게임 탐색</Link>
                </main>
              }
            />
          </Routes>
        </ThemeProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
