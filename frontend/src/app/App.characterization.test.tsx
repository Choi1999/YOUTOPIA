import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "./App";

const DEMO_EMAIL = "demo@youtopia.app";
const DEMO_PASSWORD = "Youtopia123!";

function renderApp() {
  return render(<App />);
}

async function submitEmailLogin(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  const emailInput = screen.getByLabelText("이메일 주소");
  const passwordInput = screen.getByLabelText("비밀번호");

  await user.clear(emailInput);
  await user.type(emailInput, email);
  await user.clear(passwordInput);
  await user.type(passwordInput, password);
  await user.click(screen.getByRole("button", { name: "로그인" }));
}

describe("기존 데모 로그인 characterization", () => {
  it("잘못된 자격 증명을 거부하고 기존 데모 자격 증명을 허용한다", async () => {
    const user = userEvent.setup();
    renderApp();

    await submitEmailLogin(user, DEMO_EMAIL, "wrong-password");
    expect(screen.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeInTheDocument();

    await submitEmailLogin(user, DEMO_EMAIL, DEMO_PASSWORD);
    expect(screen.getByRole("heading", { name: "로그인되었습니다." })).toBeInTheDocument();
    expect(screen.getByText(DEMO_EMAIL)).toBeInTheDocument();
  });

  it("현재 페이지 세션에서 데모 계정을 만들고 로그인할 수 있다", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "회원가입하기" }));
    const dialog = screen.getByRole("dialog", { name: "데모 계정 만들기" });
    await user.type(within(dialog).getByLabelText("이메일"), "new@yutopia.app");
    await user.type(within(dialog).getByLabelText("비밀번호 (8자 이상)"), "NewPassword1!");
    await user.type(within(dialog).getByLabelText("비밀번호 확인"), "NewPassword1!");
    await user.click(within(dialog).getByRole("button", { name: "데모 계정 만들기" }));

    expect(screen.getByText(/데모 계정을 만들었습니다/)).toBeInTheDocument();
    await submitEmailLogin(user, "new@yutopia.app", "NewPassword1!");
    expect(screen.getByRole("heading", { name: "로그인되었습니다." })).toBeInTheDocument();
  });

  it("현재 페이지 세션에서 데모 비밀번호를 재설정한다", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "비밀번호 찾기" }));
    const dialog = screen.getByRole("dialog", { name: "데모 비밀번호 재설정" });
    await user.type(within(dialog).getByLabelText("이메일"), DEMO_EMAIL);
    await user.type(within(dialog).getByLabelText("새 비밀번호 (8자 이상)"), "ChangedPassword1!");
    await user.type(within(dialog).getByLabelText("비밀번호 확인"), "ChangedPassword1!");
    await user.click(within(dialog).getByRole("button", { name: "비밀번호 변경" }));

    expect(screen.getByText(/데모 비밀번호를 변경했습니다/)).toBeInTheDocument();
    await submitEmailLogin(user, DEMO_EMAIL, "ChangedPassword1!");
    expect(screen.getByRole("heading", { name: "로그인되었습니다." })).toBeInTheDocument();
  });

  it("비밀번호 표시와 숨김을 전환한다", async () => {
    const user = userEvent.setup();
    renderApp();

    const passwordInput = screen.getByLabelText("비밀번호");
    expect(passwordInput).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "비밀번호 보기" }));
    expect(passwordInput).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "비밀번호 숨기기" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("기존 localStorage 키에서 기억한 이메일을 복원한다", async () => {
    localStorage.setItem("youtopia-login-email", DEMO_EMAIL);
    renderApp();

    await waitFor(() => expect(screen.getByLabelText("이메일 주소")).toHaveValue(DEMO_EMAIL));
    expect(screen.getByRole("checkbox", { name: "로그인 상태 유지" })).toBeChecked();
    expect(localStorage.getItem("youtopia-login-email")).toBe(DEMO_EMAIL);
  });

  it("로그아웃할 수 있고 새로고침 상당의 재마운트에서는 로그인 세션만 초기화한다", async () => {
    const user = userEvent.setup();
    const view = renderApp();

    await user.click(screen.getByRole("checkbox", { name: "로그인 상태 유지" }));
    await submitEmailLogin(user, DEMO_EMAIL, DEMO_PASSWORD);
    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();

    await submitEmailLogin(user, DEMO_EMAIL, DEMO_PASSWORD);
    view.unmount();
    renderApp();

    expect(screen.queryByRole("heading", { name: "로그인되었습니다." })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("이메일 주소")).toHaveValue(DEMO_EMAIL));
  });

  it("Google과 SSO가 실제 인증 없이 안내 메시지만 제공한다", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Google로 계속하기" }));
    expect(screen.getByText("Google 로그인을 사용하려면 OAuth 서버 설정이 필요합니다.")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "SSO 로그인" }));
    await user.type(screen.getByLabelText("회사 이메일 주소"), "person@company.com");
    await user.click(screen.getByRole("button", { name: "SSO 로그인" }));
    expect(screen.getByText("SSO 인증은 서버 연결이 필요합니다. 이메일 로그인을 이용해 주세요.")).toBeInTheDocument();
  });

  it("계정 대화상자는 초기 포커스, Escape 닫기와 트리거 포커스 복귀를 제공한다", async () => {
    const user = userEvent.setup();
    renderApp();

    const trigger = screen.getByRole("button", { name: "회원가입하기" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "데모 계정 만들기" });
    await waitFor(() => expect(within(dialog).getByLabelText("이메일")).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
