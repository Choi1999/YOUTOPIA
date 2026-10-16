import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  EMPTY_PROJECT_DRAFT,
  NEXUS_DEMO_DRAFT,
  validateProjectDraft,
} from "../features/project-demo/ProjectDemoProvider";
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

describe("YU-04 프로젝트 생성 SIMULATED", () => {
  it("NEXUS fixture와 수치 비교 구간을 유효하게 판정한다", () => {
    expect(validateProjectDraft(NEXUS_DEMO_DRAFT)).toEqual({});
    expect(NEXUS_DEMO_DRAFT.eventDate).toBe("2025-03-25");
    expect(NEXUS_DEMO_DRAFT.selectedVideoIds).toHaveLength(3);
  });

  it("빈 필수 입력과 선택 영상을 거부한다", () => {
    const errors = validateProjectDraft(EMPTY_PROJECT_DRAFT);
    expect(errors.projectName).toMatch(/입력/);
    expect(errors.game).toMatch(/입력/);
    expect(errors.eventName).toMatch(/입력/);
    expect(errors.eventDate).toMatch(/입력/);
    expect(errors.observationPeriod).toMatch(/입력/);
    expect(errors.analysisPurpose).toMatch(/입력/);
    expect(errors.selectedVideos).toMatch(/3개/);
  });

  it("중복 영상과 호환되지 않는 관측 기간을 거부한다", () => {
    const errors = validateProjectDraft({
      ...NEXUS_DEMO_DRAFT,
      observationStart: "2025-03-20",
      observationEnd: "2025-03-30",
      selectedVideoIds: [
        NEXUS_DEMO_DRAFT.selectedVideoIds[0],
        NEXUS_DEMO_DRAFT.selectedVideoIds[0],
        NEXUS_DEMO_DRAFT.selectedVideoIds[2],
      ],
    });

    expect(errors.observationPeriod).toMatch(/2025-03-11.*2025-04-07/);
    expect(errors.selectedVideos).toMatch(/중복/);
  });

  it("잘못된 날짜 순서와 관측 범위 밖 사건을 거부한다", () => {
    expect(
      validateProjectDraft({
        ...NEXUS_DEMO_DRAFT,
        observationStart: "2025-04-08",
        observationEnd: "2025-03-10",
      }).observationPeriod,
    ).toMatch(/늦을 수 없습니다/);

    expect(
      validateProjectDraft({
        ...NEXUS_DEMO_DRAFT,
        eventDate: "2025-05-01",
      }),
    ).toMatchObject({
      eventDate: expect.stringMatching(/2025-03-25/),
      observationPeriod: expect.stringMatching(/관측 기간 안/),
    });

    expect(
      validateProjectDraft({
        ...NEXUS_DEMO_DRAFT,
        eventDate: "2025-02-30",
      }).eventDate,
    ).toMatch(/유효한 사건 날짜/);
  });

  it("유효한 폼을 제출해 안정된 ID의 QUEUED 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    renderAt("/projects/new");

    await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));

    expect(screen.getByRole("heading", { name: "수집 진행 · 완료 상태" })).toBeInTheDocument();
    expect(screen.getByText("DEMO / QUEUED")).toBeInTheDocument();
    expect(screen.getByText("nexus-season-2")).toBeInTheDocument();
    expect(screen.getAllByText("DEMO / SIMULATED")).toHaveLength(4);
  });

  it("빈 폼 제출과 취소를 접근 가능한 상태 알림으로 처리한다", async () => {
    const user = userEvent.setup();
    renderAt("/projects/new");

    await user.click(screen.getByRole("button", { name: "양식 비우기" }));
    await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));
    expect(screen.getByRole("alert")).toHaveTextContent("입력 내용을 확인해 주세요");
    expect(screen.getByRole("textbox", { name: "프로젝트 이름" })).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "입력 취소" }));
    expect(screen.getByRole("status")).toHaveTextContent("프로젝트 생성을 취소했습니다");
    expect(screen.getByRole("textbox", { name: "프로젝트 이름" })).toHaveValue("NEXUS 시즌2 · v1.4 업데이트");
  });
});

describe("YU-05 수집 상태 SIMULATED", () => {
  async function createDemoProject() {
    const user = userEvent.setup();
    renderAt("/projects/new");
    await user.click(screen.getByRole("button", { name: "데이터 수집 시작 →" }));
    return user;
  }

  it("QUEUED부터 PARTIAL, FAILED, 재시도, SUCCEEDED까지 결정적으로 전이한다", async () => {
    const user = await createDemoProject();

    await user.click(screen.getByRole("button", { name: "수집 실행 시뮬레이션" }));
    expect(screen.getByText("DEMO / RUNNING")).toBeInTheDocument();
    expect(screen.getByText("4,280건")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "부분 결과 시뮬레이션" }));
    expect(screen.getByText("DEMO / PARTIAL")).toBeInTheDocument();
    expect(screen.getByText(/누락분은 0으로 대체하지 않고/)).toBeInTheDocument();
    expect(screen.getByText(/8,420 = 6,510 분석 대상 \+ 1,910 제외\/보류/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "실패 시뮬레이션" }));
    expect(screen.getByText("DEMO / FAILED")).toBeInTheDocument();
    expect(screen.getAllByText("미확정")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "데모 수집 다시 시도" }));
    expect(screen.getByText("DEMO / QUEUED")).toBeInTheDocument();
    expect(screen.getByText("2회")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "수집 실행 시뮬레이션" }));
    await user.click(screen.getByRole("button", { name: "완료 시뮬레이션" }));
    expect(screen.getByText("DEMO / SUCCEEDED")).toBeInTheDocument();
    expect(screen.getByText("12,842건")).toBeInTheDocument();
    expect(screen.getByText(/12,842 = 10,204 분석 대상 \+ 2,638 제외\/보류/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "프로젝트 대시보드 보기 →" })).toHaveAttribute(
      "href",
      "/projects/nexus-season-2/overview",
    );
  });

  it("선택 영상 세 개와 상태별 설명을 동일 fixture에서 표시한다", async () => {
    await createDemoProject();
    const records = screen.getByRole("heading", { name: "데이터 수집 기록" }).closest("section");
    expect(records).not.toBeNull();
    expect(within(records as HTMLElement).getByText("업데이트 트레일러")).toBeInTheDocument();
    expect(within(records as HTMLElement).getByText("패치노트 설명")).toBeInTheDocument();
    expect(within(records as HTMLElement).getByText("개발자 라이브")).toBeInTheDocument();
  });

  it("직접 URL 진입과 새 Provider 인스턴스는 성공 상태를 만들지 않는다", () => {
    const view = renderAt("/projects/nexus-season-2/collection");
    expect(screen.getByRole("heading", { name: "진행 중인 인메모리 수집을 찾을 수 없습니다." })).toBeInTheDocument();
    expect(screen.queryByText("DEMO / SUCCEEDED")).not.toBeInTheDocument();
    view.unmount();

    renderAt("/projects/not-the-demo/collection");
    expect(screen.getByRole("alert")).toHaveTextContent("직접 주소로 들어오거나 새로고침하면");
  });
});
