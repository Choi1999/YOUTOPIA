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
import { ApiError, type Identity } from "./api";
import { StatePanel } from "./components";
import { GameListPage, GameDetailPage, SteamGamePage } from "./GamePages";
import { SteamChartsPage, YoutubePage } from "./ChartPages";
import { SettingsPage } from "./SettingsPage";
import { AdminDashboard, AdminMemberDirectory, AdminMembers, AdminMember } from "./AdminPages";
import { ChatPreparation } from "./ChatPreparation";
import { ChatHistoryProvider } from "./ChatHistory";
import { UserActivity } from "./Activity";
import { GameAnalysisPage } from "./GameAnalysisPages";
function RouteScrollReset() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function loginDestination(kind: Identity["kind"], from: unknown) {
  const home = kind === "ADMIN" ? "/admin" : "/dashboard";
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(from)) return home;
  let path: string;
  try { path = decodeURIComponent(from.split(/[?#]/, 1)[0]); }
  catch { return home; }
  // Only registered destinations are eligible. Decode the path before checking
  // so encoded separators/dot segments cannot cross the account-realm boundary.
  const publicPage = /^\/(?:dashboard|games(?:\/steam:[1-9][0-9]{0,9}(?:\/(?:steam|youtube|reactions|keywords|events))?)?|charts\/(?:steam|youtube))\/?$/.test(path);
  const memberPage = kind === "USER" && /^\/settings\/?$/.test(path);
  const adminPage = kind === "ADMIN" && /^\/admin(?:\/(?:analytics|(?:users|members)(?:\/[A-Za-z0-9_-]+)?))?\/?$/.test(path);
  return publicPage || memberPage || adminPage ? from : home;
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
    if (session.status === "authenticated" && session.identity) {
      navigate(loginDestination(session.identity.kind, location.state?.from), {
        replace: true,
      });
    }
  }, [session.status, session.identity?.id, session.identity?.kind, location.state, navigate]);
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
function PublicShell(){return <><AppShell service/><ChatPreparation/></>;}
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
  const location=useLocation();
  if (session.status === "checking") return <StatePanel loading />;
  if (session.status === "guest") return <Navigate to="/admin/login" replace state={{from:location.pathname+location.search}} />;
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
        <ChatHistoryProvider>
        <ThemeProvider>
          <UserActivity />
          <RouteScrollReset />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Login signup />} />
            <Route path="/admin/login" element={<Login admin />} />
              <Route element={<PublicShell />}>
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
                <Route path="/games/:gameId/reactions" element={<GameAnalysisPage kind="reactions" />} />
                <Route path="/games/:gameId/keywords" element={<GameAnalysisPage kind="keywords" />} />
                <Route path="/games/:gameId/events" element={<GameAnalysisPage kind="events" />} />
                <Route path="/charts/youtube" element={<YoutubePage />} />
                <Route element={<Guard />}>
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            <Route element={<AdminGuard />}>
              <Route element={<AppShell service admin />}>
                <Route path="/admin" element={<AdminDashboard />} />
                {["/admin/users", "/admin/members"].map((path) => (
                  <Route key={path} path={path} element={<AdminMemberDirectory />}>
                    <Route index element={<AdminMembers />} />
                    <Route path=":id" element={<AdminMember />} />
                  </Route>
                ))}
                <Route path="/admin/analytics" element={<AdminDashboard />} />
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
        </ChatHistoryProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
