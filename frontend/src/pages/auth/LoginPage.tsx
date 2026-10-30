import { useContext, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { ThemeSelector } from "../../theme/ThemeSelector";
import { ServiceSessionContext } from "../../service/SessionProvider";
import { errorText, serviceApi } from "../../service/api";

type LoginMode = "email" | "sso";
type DialogMode = "signup" | "reset" | null;
type DemoAccount = { email: string; password: string };

const DEMO_EMAIL = "demo@youtopia.app";
const DEMO_PASSWORD = "Youtopia123!";

function BrandLogo() {
  return (
    <div className="brand-lockup" aria-label="YUTOPIA">
      <svg className="brand-symbol" viewBox="0 0 36 40" aria-hidden="true">
        <defs>
          <linearGradient id="logoGradient" x1="3" y1="4" x2="32" y2="36">
            <stop stopColor="#35D6FF" />
            <stop offset="1" stopColor="#495BFF" />
          </linearGradient>
        </defs>
        <path d="M4 4.8a3 3 0 0 1 4.5-2.6l25 14.4a3 3 0 0 1 0 5.2l-25 14.4A3 3 0 0 1 4 33.6V4.8Z" fill="url(#logoGradient)" />
        <path d="m13 12.8 12.2 7L13 26.9V12.8Z" fill="#B5F1FF" />
      </svg>
      <span>YUTOPIA</span>
      <small>YouTube Game Intelligence</small>
    </div>
  );
}

function LoginIllustration() {
  return (
    <svg className="hero-art" viewBox="0 0 460 330" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="screen" x1="135" y1="30" x2="398" y2="220">
          <stop stopColor="#172A51" />
          <stop offset="1" stopColor="#07142E" />
        </linearGradient>
        <linearGradient id="play" x1="286" y1="110" x2="349" y2="176">
          <stop stopColor="#FF526A" />
          <stop offset="1" stopColor="#B62349" />
        </linearGradient>
      </defs>
      <circle cx="326" cy="127" r="114" fill="#153A7B" fillOpacity=".12" />
      <path d="m117 210 189-110 111 64-187 112-113-66Z" fill="#122448" stroke="#31517F" strokeOpacity=".65" />
      <path d="m143 197 165-96v103l-165 98V197Z" fill="url(#screen)" stroke="#35578A" />
      <path d="m155 207 142-82v68l-142 83v-69Z" fill="#0C1D3C" />
      <path d="m173 224 103-59v10l-103 60v-11Zm0 19 72-42v8l-72 42v-8Z" fill="#6687C5" fillOpacity=".42" />
      <path d="m304 119 75 43v83l-75-43v-83Z" fill="#0A1731" stroke="#38588A" />
      <path d="m318 135 50 29v51l-50-29v-51Z" fill="url(#play)" />
      <path d="m338 148 21 12-21 12v-24Z" fill="white" />
      <path d="m109 216 103 60v17l-103-60v-17Z" fill="#09152C" stroke="#284775" />
      <path d="m84 290 53-31 58 34-53 31-58-34Z" fill="#101F3D" stroke="#405F8D" />
      <path d="m106 286 5-3 5 3 5-3 5 3 5-3m-25 9 5-3 5 3 5-3 5 3 5-3" stroke="#7793C0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="165" cy="292" r="3" fill="#44D9FF" />
      <circle cx="174" cy="297" r="3" fill="#FF5671" />
      <path d="m357 55 6 13 14 2-10 10 2 14-12-7-13 7 3-14-10-10 14-2 6-13Z" fill="#4A8BFF" fillOpacity=".35" />
      <circle cx="106" cy="134" r="3" fill="#39D5FF" />
      <circle cx="385" cy="94" r="2" fill="#9DB9FF" />
      <circle cx="251" cy="53" r="2" fill="#53CBFF" />
      <path d="m190 78 12-7m77 205 10-6m-151-42 7-4" stroke="#4C74B1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LoginPage({service=false,admin=false,signup=false}:{service?:boolean;admin?:boolean;signup?:boolean}={}) {
  const session=useContext(ServiceSessionContext);
  const recoveryRequestKey=useRef(crypto.randomUUID());
  const [busy,setBusy]=useState(false);
  const [mode, setMode] = useState<LoginMode>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [accounts, setAccounts] = useState<DemoAccount[]>([
    { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  ]);
  const [dialog, setDialog] = useState<DialogMode>(service&&signup?"signup":null);
  const [dialogMessage, setDialogMessage] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("youtopia-login-email") ?? "";
      setRememberEmail(savedEmail);
      setRemember(Boolean(savedEmail));
    } catch {
      setMessage("브라우저에서 로그인 정보 저장을 허용하지 않았습니다.");
    }
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      dialogTriggerRef.current?.focus();
    };
  }, [dialog]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if(service){if(busy||mode!=="email")return;setBusy(true);setMessage("");try{await session!.login(email,password,admin);try{if(remember)localStorage.setItem("youtopia-login-email",email);else localStorage.removeItem("youtopia-login-email");}catch{/* Remembering an email is optional. */}}catch(error){setMessage(errorText(error));setMessageTone("error");}finally{setBusy(false);}return;}
    const account = accounts.find(
      (candidate) =>
        candidate.email.toLowerCase() === email.toLowerCase() &&
        candidate.password === password,
    );

    if (mode === "sso") {
      setMessage("SSO 인증은 서버 연결이 필요합니다. 이메일 로그인을 이용해 주세요.");
      setMessageTone("info");
      return;
    }

    if (!account) {
      setMessage("이메일 또는 비밀번호가 올바르지 않습니다.");
      setMessageTone("error");
      return;
    }

    if (remember) {
      try {
        localStorage.setItem("youtopia-login-email", email);
      } catch {
        setMessage("로그인에 성공했지만 이 브라우저에는 이메일을 저장하지 못했습니다.");
        setMessageTone("info");
        setSignedInAs(account.email);
        return;
      }
    } else {
      try {
        localStorage.removeItem("youtopia-login-email");
      } catch {
        // Email persistence is optional; it does not prevent demo login.
      }
    }

    setSignedInAs(account.email);
    setMessage("");
    setMessageTone("success");
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if(service){if(busy)return;if(password!==confirmation){setDialogMessage("비밀번호가 서로 일치하지 않습니다.");return;}setBusy(true);try{await serviceApi.request("/api/v1/auth/signup",{method:"POST",body:{email,password}});setRememberEmail(email);setDialog(null);setMessage("가입했습니다. 이메일 소유권은 아직 확인되지 않았습니다. 로그인해 주세요.");setMessageTone("success");}catch(error){setDialogMessage(errorText(error));}finally{setBusy(false);}return;}
    if (password.length < 8) {
      setDialogMessage("비밀번호를 8자 이상 입력해 주세요.");
      return;
    }
    if (password !== confirmation) {
      setDialogMessage("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (accounts.some((account) => account.email.toLowerCase() === email.toLowerCase())) {
      setDialogMessage("이미 등록된 이메일입니다.");
      return;
    }

    setAccounts((current) => [...current, { email, password }]);
    setRememberEmail(email);
    setRemember(false);
    setDialog(null);
    setDialogMessage("");
    setMessage("데모 계정을 만들었습니다. 입력한 이메일과 비밀번호로 로그인해 주세요.");
    setMessageTone("success");
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if(service){if(busy)return;if(password!==confirmation){setDialogMessage("비밀번호가 서로 일치하지 않습니다.");return;}setBusy(true);try{await serviceApi.request(formData.get("purpose")==="account"?"/api/v1/auth/account-recovery":"/api/v1/auth/password-reset",{method:"POST",body:{email,newPassword:password,recoveryCode:String(formData.get("recoveryCode")??""),requestKey:recoveryRequestKey.current}});setDialog(null);setMessage("복구가 완료되었습니다. 새 비밀번호로 로그인해 주세요.");setMessageTone("success");}catch(error){setDialogMessage(errorText(error));}finally{setBusy(false);}return;}
    if (password.length < 8) {
      setDialogMessage("새 비밀번호를 8자 이상 입력해 주세요.");
      return;
    }
    if (password !== confirmation) {
      setDialogMessage("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (!accounts.some((account) => account.email.toLowerCase() === email.toLowerCase())) {
      setDialogMessage("등록된 데모 계정을 찾을 수 없습니다.");
      return;
    }

    setAccounts((current) =>
      current.map((account) =>
        account.email.toLowerCase() === email.toLowerCase()
          ? { ...account, password }
          : account,
      ),
    );
    setRememberEmail(email);
    setDialog(null);
    setDialogMessage("");
    setMessage("데모 비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.");
    setMessageTone("success");
  }

  function openDialog(nextDialog: Exclude<DialogMode, null>) {
    dialogTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDialogMessage("");
    setMessage("");
    setDialog(nextDialog);
  }

  function closeDialog() {
    setDialog(null);
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      ) ?? [],
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setMessage("");
    setMessageTone("info");
  }

  return (
    <main className="login-page">
      <div className="login-theme-control">
        <ThemeSelector compact />
      </div>
      <section className="intro-panel" aria-label="YUTOPIA 소개">
        <div className="intro-grid" aria-hidden="true" />
        <div className="intro-content">
          <BrandLogo />
          <LoginIllustration />
          <div className="intro-copy">
            <h1>
              유튜브의
              <br />
              게임 이야기를,
              <br />
              더 나은 의사결정으로.
            </h1>
            <p>
              게임 유튜브 데이터를 편리하고 깊이 있게 분석하고,
              <br className="desktop-break" />
              {service?"Steam과 YouTube의 실제 관측 지표를 비교하세요.":"AI와 함께 더 깊은 인사이트를 발견하세요."}
            </p>
          </div>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">▧</span>
              <span>데이터 기반 인사이트</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">◉</span>
              <span>신뢰할 수 있는 근거 제공</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">▣</span>
              <span>{service?"실제 관측 지표 비교":"LLM과의 유연한 협업"}</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon" aria-hidden="true">◇</span>
              <span>게임 비즈니스 성과 개선</span>
            </div>
          </div>
        </div>
        <p className="intro-footer">From Game Talk to Better Decisions</p>
      </section>

      <section className="auth-panel" aria-labelledby="welcome-title">
        <div className="auth-content">
          {signedInAs ? (
            <div className="signed-in-card" role="status">
              <div className="signed-in-icon" aria-hidden="true">✓</div>
              <h2>로그인되었습니다.</h2>
              <p><strong>{signedInAs}</strong> 계정으로 데모 로그인했습니다.</p>
              <p className="demo-notice">이 로그인은 현재 브라우저 세션에서만 동작하는 데모입니다.</p>
              <button className="login-button" onClick={() => setSignedInAs("")} type="button">
                로그아웃
              </button>
              <Link className="demo-entry-link" to="/connect/youtube">
                P0-1 데모 화면 열기
              </Link>
            </div>
          ) : (
          <>
          <header className="auth-heading">
            <div className="mini-brand" aria-hidden="true">
              <span className="mini-play">▶</span>
              <span>YUTOPIA에 오신 것을</span>
            </div>
            <h2 id="welcome-title">환영합니다.</h2>
          </header>

          <div className="login-tabs" role="tablist" aria-label="로그인 방식">
            <button
              aria-selected={mode === "email"}
              aria-controls="login-method-panel"
              className={mode === "email" ? "login-tab active" : "login-tab"}
              id="email-login-tab"
              onClick={() => selectMode("email")}
              role="tab"
              type="button"
            >
              이메일 로그인
            </button>
            <button
              aria-selected={mode === "sso"}
              aria-controls="login-method-panel"
              className={mode === "sso" ? "login-tab active" : "login-tab"}
              id="sso-login-tab"
              onClick={() => selectMode("sso")}
              disabled={service}
              role="tab"
              type="button"
            >
              SSO 로그인
            </button>
          </div>

          <form
            aria-labelledby={mode === "email" ? "email-login-tab" : "sso-login-tab"}
            className="auth-form"
            id="login-method-panel"
            onSubmit={handleSubmit}
            role="tabpanel"
          >
            <label htmlFor="email">{service&&admin?"관리자 로그인명":mode === "sso" ? "회사 이메일 주소" : "이메일 주소"}</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={(event) => {
                setRememberEmail(event.currentTarget.value);
                setMessage("");
              }}
              placeholder={mode === "sso" ? "name@company.com" : "you@company.com"}
              required
              type={service&&admin?"text":"email"}
              value={rememberEmail}
            />

            {mode === "email" ? (
              <>
                <label className="password-label" htmlFor="password">비밀번호</label>
                <div className="password-input">
                  <input
                    autoComplete="current-password"
                    id="password"
                    name="password"
                    onChange={() => setMessage("")}
                    placeholder="비밀번호를 입력하세요"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    className="password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    {showPassword ? "숨김" : "보기"}
                  </button>
                </div>
              </>
            ) : (
              <p className="sso-hint">회사 이메일로 조직의 SSO 로그인 정보를 확인합니다.</p>
            )}

            <div className="form-options">
              <label className="remember-label">
                <input
                  checked={remember}
                  onChange={(event) => setRemember(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>{service||mode === "sso" ? "이메일 기억하기" : "로그인 상태 유지"}</span>
              </label>
              {mode === "email" && (
                <button
                  className="forgot-button"
                  onClick={() => openDialog("reset")}
                  type="button"
                >
                  비밀번호 찾기
                </button>
              )}
            </div>

            <button className="login-button" disabled={busy} type="submit">
              {mode === "sso" ? "SSO 로그인" : "로그인"}
            </button>
            <p aria-live="polite" className={`form-message ${messageTone}`}>{message}</p>
          </form>

          {mode === "email" && (
            <>
              <div className="divider"><span>또는</span></div>
              <button
                className="google-button"
                disabled={service}
                onClick={() => {
                  setMessage("Google 로그인을 사용하려면 OAuth 서버 설정이 필요합니다.");
                  setMessageTone("info");
                }}
                type="button"
              >
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.63Z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34A9 9 0 0 0 9 18Z" />
                  <path fill="#FBBC05" d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.34Z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57A8.59 8.59 0 0 0 9 0a9 9 0 0 0-8.04 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
                </svg>
                Google로 계속하기
              </button>
            </>
          )}

          {!service&&<p className="demo-notice">
            데모 계정: <code>{DEMO_EMAIL}</code> / <code>{DEMO_PASSWORD}</code>
          </p>}
          {!admin&&<p className="signup-prompt">
            계정이 없으신가요?{" "}
            <button
              onClick={() => openDialog("signup")}
              type="button"
            >
              회원가입하기
            </button>
          </p>}
          {service&&<p className="demo-notice">{admin?"관리자 로그인":"세션으로 안전하게 연결합니다."} · <a href="/demo/login">기존 데모 보기</a></p>}
          </>
          )}
        </div>
      </section>
      {dialog && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description dialog-warning"
            aria-modal="true"
            className="account-dialog"
            onKeyDown={handleDialogKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <button
              aria-label="창 닫기"
              className="dialog-close"
              onClick={closeDialog}
              type="button"
            >
              ×
            </button>
            <h2 id="dialog-title">
              {dialog === "signup" ? service?"회원가입":"데모 계정 만들기" : service?"복구코드로 비밀번호 재설정":"데모 비밀번호 재설정"}
            </h2>
            <p className="dialog-description" id="dialog-description">
              {service?"이메일 소유권 확인을 대신하지 않습니다. 비밀번호는 15~128자이며 복구코드는 한 번만 사용할 수 있습니다.":dialog === "signup"
                ? "입력한 계정은 현재 브라우저 세션에서만 사용할 수 있습니다."
                : "이메일 확인 없이 현재 세션의 데모 비밀번호만 변경합니다."}
            </p>
            <form
              className="dialog-form"
              onChange={()=>{recoveryRequestKey.current=crypto.randomUUID();}}
              key={dialog}
              onSubmit={dialog === "signup" ? handleSignup : handlePasswordReset}
            >
              <label htmlFor="dialog-email">이메일</label>
              <input
                autoComplete="email"
                defaultValue={dialog === "reset" ? rememberEmail : ""}
                id="dialog-email"
                name="email"
                placeholder="you@example.com"
                required
                type="email"
              />
              <label htmlFor="dialog-password">
                {service?"비밀번호 (15~128자)":dialog === "signup" ? "비밀번호 (8자 이상)" : "새 비밀번호 (8자 이상)"}
              </label>
              <input
                autoComplete="new-password"
                id="dialog-password"
                minLength={service?15:8}
                name="password"
                placeholder="8자 이상 입력"
                required
                type="password"
              />
              <label htmlFor="dialog-confirmation">비밀번호 확인</label>
              <input
                autoComplete="new-password"
                id="dialog-confirmation"
                minLength={service?15:8}
                name="confirmation"
                placeholder="비밀번호를 다시 입력"
                required
                type="password"
              />
              {service&&dialog==="reset"&&<><label htmlFor="dialog-purpose">복구 종류</label><select id="dialog-purpose" name="purpose"><option value="password">비밀번호 재설정</option><option value="account">탈퇴 계정 복구 · 신청 후 72시간 이내</option></select><label htmlFor="dialog-code">일회용 복구코드</label><input id="dialog-code" name="recoveryCode" required autoComplete="off" maxLength={64}/></>}
              <p aria-live="polite" className="dialog-message">{dialogMessage}</p>
              <button className="login-button" disabled={busy} type="submit">
                {dialog === "signup" ? service?"회원가입":"데모 계정 만들기" : "비밀번호 변경"}
              </button>
            </form>
            <p className="dialog-warning" id="dialog-warning">
              {service?"복구코드·비밀번호를 다른 사람과 공유하지 마세요.":"서버 없는 시연용 기능입니다. 계정은 새로고침하면 사라지며 이메일 인증은 수행하지 않습니다."}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
