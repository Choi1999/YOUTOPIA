
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AnalysisTarget } from "../features/analysis-target/analysisTarget";
import type { AnalysisRepository } from "../features/analysis/data/AnalysisRepository";
import { AnalysisRepositoryProvider } from "../features/analysis/data/AnalysisRepositoryContext";
import { createValidatedDemoAnalysisRepository } from "../features/analysis/data/ValidatedDemoAnalysisRepository";
import { demoReadySnapshot } from "../features/analysis/data/demoReadySnapshot";
import { ThemeProvider } from "../theme/ThemeProvider";

import { App } from "./App";
import { AppRoutes } from "./AppRoutes";

const VIDEO_A = "Ab0_-123xyz";
const VIDEO_B = "Zb0_-123xyz";

function analysisPath(videoId: string) {
  return `/analysis/youtube/video/${videoId}`;
}

/**
 * 테스트에서만 사용하는 영상 전환 버튼.
 * 실제 AppShell이나 사용자 UI에는 추가하지 않는다.
 */
function TestVideoSwitcher() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(analysisPath(VIDEO_B))}
    >
      테스트: 영상 B로 이동
    </button>
  );
}

/**
 * 실제 AppRoutes와 공통 Provider를 사용하는 통합 테스트.
 * Repository만 테스트용 공급자로 주입한다.
 */
function renderWithRepository(
  repository: AnalysisRepository,
  showSwitcher = false,
) {
  return render(
    <MemoryRouter initialEntries={[analysisPath(VIDEO_A)]}>
      <ThemeProvider>
        <AnalysisRepositoryProvider repository={repository}>
          {showSwitcher && <TestVideoSwitcher />}
          <AppRoutes />
        </AnalysisRepositoryProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * 테스트에서 Promise의 완료 시점을 직접 제어한다.
 * 타이머나 실제 네트워크는 사용하지 않는다.
 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("AnalysisRepository 통합 및 비동기 안전성", () => {
  it("실제 App에서 검증된 합성 READY 데이터를 표시한다", async () => {
    window.history.replaceState(
      {},
      "",
      analysisPath(VIDEO_A),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "분석 스냅샷 조회 결과",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText("긍정: 62.5%"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /합성 데모 데이터이며 실제 YouTube 분석 결과가 아닙니다/,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("main"),
    ).toHaveTextContent("분석 상태: READY");
  });

  it("잘못된 스냅샷은 전체 라우팅에서도 오류로 처리한다", async () => {
    const repository = createValidatedDemoAnalysisRepository({
      async getSnapshot() {
        return {
          kind: "FOUND",
          snapshot: {
            ...demoReadySnapshot,
            sample: {
              ...demoReadySnapshot.sample,
              rawCount: 121,
            },
          },
        };
      },
    });

    renderWithRepository(repository);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("조회 중 오류");

    expect(
      screen.queryByText("긍정: 62.5%"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("원시 댓글: 121건"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("분석 데이터가 아직 제공되지 않습니다."),
    ).not.toBeInTheDocument();
  });

  it("NOT_FOUND는 오류가 아닌 데이터 미제공으로 표시한다", async () => {
    const repository = createValidatedDemoAnalysisRepository({
      async getSnapshot() {
        return { kind: "NOT_FOUND" };
      },
    });

    renderWithRepository(repository);

    expect(
      await screen.findByText(
        "분석 데이터가 아직 제공되지 않습니다.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("alert"),
    ).not.toBeInTheDocument();
  });

  it("영상 A의 늦은 성공 응답이 영상 B를 덮어쓰지 않는다", async () => {
    const user = userEvent.setup();

    const requestA = createDeferred<unknown>();
    const requestB = createDeferred<unknown>();

    const getSnapshot = vi.fn(
      (target: AnalysisTarget): Promise<unknown> => {
        return target.targetId === VIDEO_A
          ? requestA.promise
          : requestB.promise;
      },
    );

    const repository =
      createValidatedDemoAnalysisRepository({ getSnapshot });

    renderWithRepository(repository, true);

    expect(getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: VIDEO_A }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "테스트: 영상 B로 이동",
      }),
    );

    expect(getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: VIDEO_B }),
    );

    // B의 응답을 먼저 완료한다.
    await act(async () => {
      requestB.resolve({
        kind: "FOUND",
        snapshot: {
          ...demoReadySnapshot,
          snapshotId: "synthetic-video-b-001",
          target: {
            ...demoReadySnapshot.target,
            targetId: VIDEO_B,
          },
        },
      });
    });

    expect(
      await screen.findByText(`영상 ID: ${VIDEO_B}`),
    ).toBeInTheDocument();

    // 화면 이동 전에 시작한 A의 응답을 나중에 완료한다.
    await act(async () => {
      requestA.resolve({
        kind: "FOUND",
        snapshot: demoReadySnapshot,
      });
    });

    expect(
      screen.getByText(`영상 ID: ${VIDEO_B}`),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(`영상 ID: ${VIDEO_A}`),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("alert"),
    ).not.toBeInTheDocument();
  });

  it("영상 A의 늦은 실패가 영상 B에 오류를 표시하지 않는다", async () => {
    const user = userEvent.setup();
    const requestA = createDeferred<unknown>();

    const repository = createValidatedDemoAnalysisRepository({
      getSnapshot(target) {
        if (target.targetId === VIDEO_A) {
          return requestA.promise;
        }

        return Promise.resolve({ kind: "NOT_FOUND" });
      },
    });

    renderWithRepository(repository, true);

    await user.click(
      screen.getByRole("button", {
        name: "테스트: 영상 B로 이동",
      }),
    );

    expect(
      await screen.findByText(
        "분석 데이터가 아직 제공되지 않습니다.",
      ),
    ).toBeInTheDocument();

    // 이미 종료된 A 요청이 뒤늦게 실패한다.
    await act(async () => {
      requestA.reject(new Error("OLD_REQUEST_FAILED"));
    });

    expect(
      screen.getByText(
        "분석 데이터가 아직 제공되지 않습니다.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("alert"),
    ).not.toBeInTheDocument();
  });
});
