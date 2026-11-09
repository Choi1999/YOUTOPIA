import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ServerAccountPage } from "./ServerAccountPage";
import {
  serverMemberClient, ServerSessionError,
} from "../../features/server-session/serverMemberSession";
import {
  MetadataCapabilityError, serverMetadataCapabilitiesClient,
} from "../../features/server-session/serverMetadataCapabilities";

const identity = {
  kind: "USER" as const,
  id: "12345678-1234-1234-1234-123456789abc",
  emailVerified: false,
};

function mount() {
  return render(
    <MemoryRouter>
      <ServerAccountPage/>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("UI-R04-AO — Spring account UI independent of demo login", () => {
  it("performs no requests without user intent, then displays guest only on server 401", async () => {
    const check = vi.spyOn(serverMemberClient,"check")
      .mockResolvedValue({status:"guest"});
    const login = vi.spyOn(serverMemberClient,"login");
    mount();
    expect(screen.getByText("아직 서버 확인을 요청하지 않았습니다."))
      .toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button",{name:"서버 세션 확인"}));
    await waitFor(() => expect(screen.getByText("서버 회원 로그인 안 됨"))
      .toBeInTheDocument());
    expect(check).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole("link",{name:"데모 로그인 화면"}))
      .toHaveAttribute("href","/login");
  });

  it("only displays authenticated status after server-verified USER login", async () => {
    const login = vi.spyOn(serverMemberClient,"login").mockResolvedValue(identity);
    const logout=vi.spyOn(serverMemberClient,"logout").mockResolvedValue(undefined);
    const user=userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("서버 계정 이메일"),
      "member@example.invalid");
    const password = screen.getByLabelText("비밀번호");
    await user.type(password,"synthetic-password");
    await user.click(screen.getByRole("button",{name:"Spring 회원 로그인"}));
    await waitFor(() => expect(screen.getByText("서버에서 인증된 USER 회원"))
      .toBeInTheDocument());
    expect(login).toHaveBeenCalledWith("member@example.invalid","synthetic-password");
    expect(password).toHaveValue("");
    expect(screen.getByText(identity.id)).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    await user.click(screen.getByRole("button",{name:"서버 로그아웃"}));
    await waitFor(() => expect(screen.getByText("서버 회원 로그인 안 됨"))
      .toBeInTheDocument());
    expect(logout).toHaveBeenCalledOnce();
  });

  it("treats rejected credentials as guest, not as backend success or outage", async () => {
    vi.spyOn(serverMemberClient,"login")
      .mockRejectedValue(new ServerSessionError("LOGIN_REJECTED"));
    const user=userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("서버 계정 이메일"),"member@example.invalid");
    await user.type(screen.getByLabelText("비밀번호"),"incorrect");
    await user.click(screen.getByRole("button",{name:"Spring 회원 로그인"}));
    await waitFor(() => expect(screen.getByText("서버 회원 로그인 안 됨"))
      .toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("서버가 로그인을 승인하지 않았습니다");
    expect(screen.queryByText("서버에서 인증된 USER 회원")).not.toBeInTheDocument();
  });

  it("rejects unconfirmed sessions without a demo-account fallback", async () => {
    vi.spyOn(serverMemberClient,"login")
      .mockRejectedValue(new ServerSessionError("SESSION_NOT_CONFIRMED"));
    const user=userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("서버 계정 이메일"),
      "member@example.invalid");
    await user.type(screen.getByLabelText("비밀번호"),"synthetic-password");
    await user.click(screen.getByRole("button",{name:"Spring 회원 로그인"}));
    await waitFor(() => expect(screen.getByText("서버 세션 확인 불가"))
      .toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인으로 처리하지 않습니다");
    expect(screen.queryByText("서버에서 인증된 USER 회원"))
      .not.toBeInTheDocument();
  });
  it("does not request capability until confirmed USER explicitly checks", async () => {
    const session = vi.spyOn(serverMemberClient, "check")
      .mockResolvedValue({ status: "authenticated", identity });
    const capability = vi.spyOn(serverMetadataCapabilitiesClient, "check")
      .mockResolvedValue({ status: "unavailable", policy: "POLICY_HOLD" });
    const user = userEvent.setup();
    mount();
    expect(capability).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"조회 가능 여부 확인"}))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("button",{name:"서버 세션 확인"}));
    await waitFor(() => expect(screen.getByText("서버에서 인증된 USER 회원"))
      .toBeInTheDocument());
    expect(session).toHaveBeenCalledOnce();
    expect(capability).not.toHaveBeenCalled();
    expect(screen.getByText("현재 기능 상태를 아직 확인하지 않았습니다."))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button",{name:"조회 가능 여부 확인"}));
    await waitFor(() => expect(screen.getByText(
      "YouTube 영상 정보와 댓글 조회는 아직 제공되지 않습니다.",
    )).toBeInTheDocument());
    expect(capability).toHaveBeenCalledOnce();
    expect(screen.queryByText("POLICY_HOLD")).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("hides capabilities when server session expires and resets on logout", async () => {
    vi.spyOn(serverMemberClient, "check")
      .mockResolvedValue({status: "authenticated", identity});
    const logout = vi.spyOn(serverMemberClient, "logout").mockResolvedValue();
    const cap = vi.spyOn(serverMetadataCapabilitiesClient, "check")
      .mockRejectedValueOnce(new MetadataCapabilityError("AUTH_REQUIRED"))
      .mockResolvedValueOnce({ status: "unavailable", policy: "POLICY_HOLD" });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button",{name:"서버 세션 확인"}));
    await waitFor(() => expect(screen.getByText("서버에서 인증된 USER 회원"))
      .toBeInTheDocument());
    await user.click(screen.getByRole("button",{name:"조회 가능 여부 확인"}));
    await waitFor(() => expect(screen.getByText("서버 회원 로그인 안 됨"))
      .toBeInTheDocument());
    expect(screen.queryByRole("button",{name:"조회 가능 여부 확인"}))
      .not.toBeInTheDocument();

    const login = vi.spyOn(serverMemberClient, "login")
      .mockResolvedValue(identity);
    await user.type(screen.getByLabelText("서버 계정 이메일"),
      "member@example.invalid");
    await user.type(screen.getByLabelText("비밀번호"),"synthetic-password");
    await user.click(screen.getByRole("button",{name:"Spring 회원 로그인"}));
    await waitFor(() => expect(screen.getByText("서버에서 인증된 USER 회원"))
      .toBeInTheDocument());
    expect(login).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button",{name:"조회 가능 여부 확인"}));
    await waitFor(() => expect(screen.getByText(
      "YouTube 영상 정보와 댓글 조회는 아직 제공되지 않습니다.",
    )).toBeInTheDocument());
    expect(cap).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button",{name:"서버 로그아웃"}));
    await waitFor(() => expect(screen.getByText("서버 회원 로그인 안 됨"))
      .toBeInTheDocument());
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button",{name:"조회 가능 여부 확인"}))
      .not.toBeInTheDocument();
  });

  it("fails closed for invalid or denied capability without enabling a reader", async () => {
    vi.spyOn(serverMemberClient, "check")
      .mockResolvedValue({status: "authenticated", identity});
    const capability = vi.spyOn(serverMetadataCapabilitiesClient, "check")
      .mockRejectedValue(new MetadataCapabilityError("UNEXPECTED_SERVER_RESPONSE"));
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button",{name:"서버 세션 확인"}));
    await waitFor(() => expect(screen.getByText("서버에서 인증된 USER 회원"))
      .toBeInTheDocument());
    await user.click(screen.getByRole("button",{name:"조회 가능 여부 확인"}));
    await waitFor(() => expect(screen.getByText(
      "서버 상태를 확인할 수 없어 조회 기능을 사용할 수 없습니다.",
    )).toBeInTheDocument());
    expect(capability).toHaveBeenCalledOnce();
    expect(screen.queryByText(/메타데이터 준비됨|API 키|인증된 제공자/))
      .not.toBeInTheDocument();
  });

});
