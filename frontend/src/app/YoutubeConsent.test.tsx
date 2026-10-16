import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "../theme/ThemeProvider";
import { AppRoutes } from "./AppRoutes";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Google 연결 · 권한 승인 →" }));
  expect(screen.getByRole("heading", { name: "선택한 읽기 범위를 확인해 주세요." })).toBeInTheDocument();
}

describe("YU-02/YU-03 로컬 권한 시뮬레이션", () => {
  it("로그인과 선택적 YouTube 권한을 구분하고 Figma 권한 목록을 표시한다", () => {
    renderAt("/connect/youtube");

    expect(screen.getByRole("heading", { name: "YouTube 채널 연결 · 권한 요청" })).toBeInTheDocument();
    expect(screen.getByText("서비스 로그인과 YouTube 권한은 서로 다릅니다.")).toBeInTheDocument();
    for (const permission of ["채널 식별", "영상 목록", "댓글 목록", "관리 권한"]) {
      expect(screen.getByRole("heading", { name: permission })).toBeInTheDocument();
    }
  });

  it("검토 후 로컬 승인하고 YU-03에서 SIMULATED 상태만 표시한다", async () => {
    const user = userEvent.setup();
    renderAt("/connect/youtube");

    await openReview(user);
    await user.click(screen.getByRole("button", { name: "시뮬레이션 승인" }));

    expect(screen.getByRole("heading", { name: "채널 권한 승인 완료" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "NEXUS 공식 채널이 연결된 것으로 시뮬레이션했습니다." })).toBeInTheDocument();
    expect(screen.getByText("SIMULATED")).toBeInTheDocument();
    expect(Object.keys(localStorage).some((key) => /token|credential|youtube-connection/i.test(key))).toBe(false);
  });

  it.each([
    ["거부", "권한 요청이 거부되었습니다."],
    ["취소", "권한 검토가 취소되었습니다."],
  ])("%s 상태를 알리고 다시 검토할 수 있다", async (action, announcement) => {
    const user = userEvent.setup();
    renderAt("/connect/youtube");

    await openReview(user);
    await user.click(screen.getByRole("button", { name: action }));
    expect(screen.getByRole("status")).toHaveTextContent(announcement);

    await user.click(screen.getByRole("button", { name: "권한 다시 검토" }));
    expect(screen.getByRole("heading", { name: "선택한 읽기 범위를 확인해 주세요." })).toBeInTheDocument();
  });

  it("승인 만료 후 완료 상태를 차단하고 다시 연결한다", async () => {
    const user = userEvent.setup();
    renderAt("/connect/youtube");

    await openReview(user);
    await user.click(screen.getByRole("button", { name: "시뮬레이션 승인" }));
    await user.click(screen.getByRole("button", { name: "승인 만료 시뮬레이션" }));

    expect(screen.getByRole("heading", { name: "시뮬레이션 승인이 만료되었습니다." })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 연결" }));
    expect(screen.getByRole("heading", { name: "YouTube 채널 연결 · 권한 요청" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("시뮬레이션 승인이 만료되었습니다.");
  });

  it("YU-03 직접 진입은 승인 상태를 만들지 않는다", () => {
    renderAt("/connect/youtube/complete");

    expect(screen.getByRole("heading", { name: "승인 상태를 확인할 수 없습니다." })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("직접 주소로 들어오거나 새로고침한 경우 승인 완료 상태를 만들지 않습니다.");
    expect(screen.queryByRole("link", { name: "관측 프로젝트 만들기 →" })).not.toBeInTheDocument();
  });
});
