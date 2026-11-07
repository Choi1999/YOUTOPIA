import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  serverMemberClient, serverSessionErrorMessage,
  type ServerMemberIdentity,
} from "../../features/server-session/serverMemberSession";
import "./server-account.css";

type View =
  | Readonly<{ status: "unchecked" | "guest" | "unavailable" }>
  | Readonly<{ status: "authenticated"; identity: ServerMemberIdentity }>;

/**
 * UI-R04-AO. Explicit real Spring MEMBER login only. Never uses or trusts the
 * browser-only demo accounts, never persists credentials or identity.
 * Demo workspace routes remain available independently.
 */
export function ServerAccountPage() {
  const [view, setView] = useState<View>({ status: "unchecked" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function run(operation: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (cause) {
      if (mounted.current) {
        setView({ status: "unavailable" });
        setError(serverSessionErrorMessage(cause));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function check() {
    void run(async () => {
      const current = await serverMemberClient.check();
      if (!mounted.current) return;
      setView(current);
      setMessage(current.status === "authenticated"
        ? "Spring 서버가 USER 회원 세션을 확인했습니다."
        : "현재 인증된 Spring 회원 세션이 없습니다.");
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const login = String(data.get("login") ?? "").trim();
    const password = String(data.get("password") ?? "");
    // Do not leave a credential in a rendered form after submission.
    const field = form.elements.namedItem("password");
    if (field instanceof HTMLInputElement) field.value = "";
    void run(async () => {
      const identity = await serverMemberClient.login(login,password);
      if (!mounted.current) return;
      setView({ status: "authenticated", identity });
      setMessage("Spring 서버가 로그인 후 USER 세션을 다시 확인했습니다.");
    });
  }

  function logout() {
    void run(async () => {
      await serverMemberClient.logout();
      if (!mounted.current) return;
      setView({ status: "guest" });
      setMessage("Spring 서버에서 세션 종료를 확인했습니다.");
    });
  }

  return (
    <div className="server-session-page">
      <header>
        <p className="server-session-eyebrow">YOUTOPIA / MEMBER SESSION</p>
        <h1>Spring 서버 회원 세션</h1>
        <p>실제 서버 회원 인증을 확인하는 별도 화면입니다.
          브라우저 데모 로그인과 연결되지 않으며, YouTube 데이터는 수집하지 않습니다.</p>
      </header>

      <section aria-label="Spring 서버 연결 상태" className="server-session-card">
        <h2>서버 인증 상태</h2>
        <p className="server-session-status" role="status">
          {view.status === "unchecked" ? "아직 서버 확인을 요청하지 않았습니다."
            : view.status === "guest" ? "서버 회원 로그인 안 됨"
            : view.status === "unavailable" ? "서버 세션 확인 불가"
            : "서버에서 인증된 USER 회원"}
        </p>
        {view.status === "authenticated" && (
          <div className="server-session-identity" aria-label="서버 인증 회원">
            <p>인증 유형: <strong>{view.identity.kind}</strong></p>
            <p>서버 사용자 ID: <code>{view.identity.id}</code></p>
            <p>이메일 인증 여부: {view.identity.emailVerified ? "확인됨" : "미확인"}</p>
          </div>
        )}
        <div className="server-session-actions">
          <button type="button" disabled={busy} onClick={check}>
            서버 세션 확인
          </button>
          <button type="button" disabled={busy || view.status !== "authenticated"}
            onClick={logout}>
            서버 로그아웃
          </button>
        </div>
        {error && <p role="alert" className="server-session-error">{error}</p>}
        {message && <p className="server-session-message">{message}</p>}
      </section>

      <section aria-label="Spring 회원 로그인" className="server-session-card">
        <h2>실제 회원 로그인</h2>
        <p>서버에 등록된 회원 계정만 사용할 수 있습니다.
          기존 데모 계정은 서버 계정이 아닙니다.</p>
        <form className="server-session-form" onSubmit={submit}>
          <label htmlFor="server-member-login">서버 계정 이메일</label>
          <input id="server-member-login" name="login" type="email"
            autoComplete="username" required maxLength={254}
            placeholder="서버에 등록된 이메일"/>
          <label htmlFor="server-member-password">비밀번호</label>
          <input id="server-member-password" name="password" type="password"
            autoComplete="current-password" required maxLength={512}/>
          <button type="submit" disabled={busy || view.status === "authenticated"}>
            {busy ? "서버 확인 중" : "Spring 회원 로그인"}
          </button>
        </form>
        <p className="server-session-caution">
          로그인 요청은 동일 출처의 Spring API로만 전송됩니다.
          서버 CSRF 토큰과 HttpOnly 쿠키를 사용하며, 비밀번호와 세션 토큰은
          이 페이지의 브라우저 저장소에 보관하지 않습니다.
        </p>
      </section>

      <nav aria-label="YOUTOPIA 로그인 화면 이동" className="server-session-navigation">
        <Link to="/login">데모 로그인 화면</Link>
        <Link to="/analysis/youtube/workspace">데모 분석 워크스페이스</Link>
      </nav>
      <p className="server-session-footnote">
        연결이 불가능하면 서버가 실행 중인지, 같은 출처로 연결되는지,
        계정 및 세션 저장소가 준비되어 있는지 확인해야 합니다.
        이 화면은 서버 연결 실패를 데모 로그인 성공으로 대체하지 않습니다.
      </p>
    </div>
  );
}
