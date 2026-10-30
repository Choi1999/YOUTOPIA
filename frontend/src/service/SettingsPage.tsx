import { useEffect, useState, useRef, type FormEvent } from "react";
import { usePageView } from "./Activity";
import { ThemeSelector } from "../theme/ThemeSelector";
import { useTheme } from "../theme/ThemeProvider";
import { serviceApi, errorText } from "./api";
import { useSession } from "./SessionProvider";
import { Frame, StatePanel, useResource, time } from "./components";
export function SettingsPage() {
  const session = useSession();
  const theme = useTheme();
  const profile = useResource("own-profile", (s) =>
    serviceApi.request<{
      loginEmail: string;
      emailVerified: boolean;
      accountStatus: string;
      createdAt: string;
    }>("/api/v1/me/account", { signal: s, account: session.identity!.id }),
  );
  const [message, setMessage] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const codeGeneration = useRef(-1),
    scope = useRef(session.generation);
  scope.current = session.generation;
  const requests = useRef({
    password: crypto.randomUUID(),
    codes: crypto.randomUUID(),
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCodes([]);
    setMessage("");
  }, [session.generation]);
  async function security(event: FormEvent<HTMLFormElement>, issue: boolean) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form),
      generation = session.generation;
    setBusy(true);
    setMessage("");
    setCodes([]);
    try {
      const result = await serviceApi.request<{ codes?: string[] }>(
        issue ? "/api/v1/auth/recovery-codes" : "/api/v1/auth/password",
        {
          method: "POST",
          account: session.identity!.id,
          body: {
            requestKey: issue
              ? requests.current.codes
              : requests.current.password,
            currentPassword: String(data.get("currentPassword") ?? ""),
            ...(!issue
              ? { newPassword: String(data.get("newPassword") ?? "") }
              : {}),
          },
        },
      );
      if (scope.current !== generation) return;
      form.reset();
      requests.current[issue ? "codes" : "password"] = crypto.randomUUID();
      if (issue) {
        codeGeneration.current = generation;
        setCodes(result.codes ?? []);
        setMessage(
          "새 복구코드입니다. 기존 코드는 무효화됐습니다. 안전한 곳에 보관해 주세요.",
        );
      } else {
        setMessage("비밀번호를 변경했습니다. 다시 로그인해 주세요.");
        await session.refresh();
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  usePageView("settings", Boolean(profile.data));
  return (
    <Frame title="내 계정 · 설정">
      <StatePanel
        loading={profile.loading}
        error={profile.error}
        retry={profile.retry}
      />
      {profile.data && (
        <section className="trend-chart-panel">
          <h2>{profile.data.loginEmail}</h2>
          <p>
            이메일 소유권 {profile.data.emailVerified ? "확인" : "미확인"} ·{" "}
            {profile.data.accountStatus} · 가입 {time(profile.data.createdAt)}
          </p>
        </section>
      )}
      <section className="trend-chart-panel">
        <h2>화면 테마</h2>
        <p className="chart-caption">
          시스템을 선택하면 기기의 테마를 따릅니다. 로그인 계정에 저장한 선택은
          다른 계정과 공유하지 않습니다.
        </p>
        <ThemeSelector />
        {theme.pending && <p role="status">설정을 확인하고 있습니다.</p>}
        {theme.error && <p role="alert">{theme.error}</p>}
      </section>
      <div className="service-chart-grid">
        <section className="trend-chart-panel">
          <h2>비밀번호 변경</h2>
          <form
            className="dialog-form"
            onChange={() => {
              requests.current.password = crypto.randomUUID();
            }}
            onSubmit={(e) => {
              void security(e, false);
            }}
          >
            <label>
              현재 비밀번호
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              새 비밀번호 (15~128자)
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={15}
                maxLength={512}
                required
              />
            </label>
            <button className="primary-action" disabled={busy}>
              비밀번호 변경
            </button>
          </form>
        </section>
        <section className="trend-chart-panel">
          <h2>복구코드 발급 · 재발급</h2>
          <form
            className="dialog-form"
            onChange={() => {
              requests.current.codes = crypto.randomUUID();
            }}
            onSubmit={(e) => {
              void security(e, true);
            }}
          >
            <label>
              현재 비밀번호 확인
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary-action" disabled={busy}>
              복구코드 재발급
            </button>
          </form>
          <p className="chart-caption">
            일회용 코드 8개를 발급합니다. 코드 재발급은 이전 코드를 모두
            무효화합니다.
          </p>
          {codeGeneration.current === session.generation &&
            codes.length > 0 && (
              <div className="recovery-codes">
                <ul>
                  {codes.map((code) => (
                    <li key={code}>
                      <code>{code}</code>
                    </li>
                  ))}
                </ul>
                <button className="back-button" onClick={() => setCodes([])}>
                  보관 완료 · 코드 숨기기
                </button>
              </div>
            )}
        </section>
      </div>
      {message && <p role="status">{message}</p>}
      <section className="trend-chart-panel">
        <h2>회원 탈퇴</h2>
        <p>
          탈퇴 후 복구 유예는 정확히 72시간이며 이후에는 복구할 수 없습니다.
          보존·파기 정책 검토가 완료되기 전에는 신규 탈퇴 접수를 제공하지
          않습니다.
        </p>
        <button className="back-button" disabled>
          운영 접수 보류
        </button>
      </section>
    </Frame>
  );
}
