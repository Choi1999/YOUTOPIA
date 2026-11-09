import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoEvidenceExplorerPage } from "./VideoEvidenceExplorerPage";

function g2gFixture() {
  return {
    schemaVersion: 1, kind: "G2G_LOCAL_OPERATOR_ADJUDICATION_V01",
    film: "Sintel", durationMs: 888032, sourceVideoSha256: "a".repeat(64),
    independentBlindGoldApproved: 0, g3Authorized: false, externalProviderCalls: 0, actualSpendUsd: 0,
    questions: Array.from({ length: 6 }, (_, index) => ({
      questionId: "G2E-SIN-0" + (index + 1),
      questionText: "합성 테스트용 영상 속 인물의 행동과 시점을 설명하시오.",
      kind: index === 5 ? "UNSUPPORTED" : "VISUAL",
      result: index === 0 ? {
        status: "APPROVE", finalVerdict: "SUPPORTED",
        operatorViewedSource: true, finalAnswerText: "인물이 주변을 살펴본다.",
        finalEvidence: [{
          modality: "FRAME", localStartMs: 88011, localEndMs: 90418,
          observationNote: "합성 시험의 영상 속 인물이 특정한 방향으로 몸을 움직인다.",
        }],
      } : index === 5 ? { status: "HOLD" } : { status: "PENDING" },
    })),
  };
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true, value: vi.fn(() => "blob:local-only-video"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true, value: vi.fn(),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("YU-49 product-facing local video evidence explorer", () => {
  it("opens a dedicated local-only workspace without reviewer approval panels", () => {
    render(<VideoEvidenceExplorerPage />);
    expect(screen.getByRole("heading", { name: "영상 근거 탐색" })).toBeInTheDocument();
    expect(screen.getByLabelText("로컬 영상 파일")).toBeInTheDocument();
    expect(screen.getByLabelText("로컬 SRT 자막")).toBeInTheDocument();
    expect(screen.getByLabelText("G2-G 운영자 판정 JSON")).toBeInTheDocument();
    expect(screen.getByText(/아직 근거가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/골드 승인 버튼|G3 승인 버튼/)).not.toBeInTheDocument();
  });

  it("opens a user-selected local video and creates a timestamped personal note in memory", async () => {
    const user = userEvent.setup();
    render(<VideoEvidenceExplorerPage />);
    await user.upload(screen.getByLabelText("로컬 영상 파일"),
      new File(["fake video bytes"], "local.mp4", { type: "video/mp4" }));
    const video = await screen.findByLabelText("선택한 로컬 영상");
    expect(video).toHaveAttribute("src", "blob:local-only-video");
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 12.345 });
    fireEvent.timeUpdate(video);
    await user.type(screen.getByLabelText("관찰 기록"), "이 장면에서 캐릭터가 설원을 걷는다.");
    await user.click(screen.getByRole("button", { name: "시점 메모 추가" }));
    const list = screen.getByLabelText("근거 목록");
    expect(within(list).getByText("이 장면에서 캐릭터가 설원을 걷는다.")).toBeInTheDocument();
    expect(within(list).getByText("00:12.345 – 00:14.345")).toBeInTheDocument();
    expect(screen.getByText(/서버에 저장되지 않습니다/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "화면 비우기" }));
    expect(screen.getByText(/아직 근거가 없습니다/)).toBeInTheDocument();
  });

  it("loads G2-G operator evidence and shows only matching filtered nodes", async () => {
    const user = userEvent.setup();
    render(<VideoEvidenceExplorerPage />);
    await user.upload(screen.getByLabelText("G2-G 운영자 판정 JSON"),
      new File([JSON.stringify(g2gFixture())], "operator.json", { type: "application/json" }));
    await waitFor(() =>
      expect(screen.getByText(/운영자 판정 기록 1문항을 불러왔습니다/)).toBeInTheDocument());
    const list = screen.getByLabelText("근거 목록");
    expect(within(list).getByText(/합성 시험의 영상 속 인물이/)).toBeInTheDocument();
    expect(screen.getByText(/비블라인드 판정 기록/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("근거 유형"), "AUDIO");
    expect(screen.getByText(/현재 검색·필터에 일치하는 근거가 없습니다/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("근거 유형"), "FRAME");
    expect(within(list).getByText(/합성 시험의 영상 속 인물이/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("근거 검색"), "일치하지 않는 글자");
    expect(screen.getByText(/현재 검색·필터에 일치하는 근거가 없습니다/)).toBeInTheDocument();
  });

  it("rejects wrong JSON shape rather than displaying fabricated approval evidence", async () => {
    const user = userEvent.setup();
    render(<VideoEvidenceExplorerPage />);
    await user.upload(screen.getByLabelText("G2-G 운영자 판정 JSON"),
      new File(['{"kind":"G2F_LOCAL_BLIND_REVIEW_PACKET"}'], "wrong.json", { type: "application/json" }));
    await waitFor(() =>
      expect(screen.getByText(/G2-G 운영자 판정 파일 또는 승인 게이트/)).toBeInTheDocument());
    expect(screen.getByText(/아직 근거가 없습니다/)).toBeInTheDocument();
  });

  it("loads SRT text safely, preserving HTML-like strings as plain subtitles", async () => {
    const user = userEvent.setup();
    const view = render(<VideoEvidenceExplorerPage />);
    await user.upload(screen.getByLabelText("로컬 SRT 자막"),
      new File(["1\n00:00:00,000 --> 00:00:03,000\n<script>not executed</script>\n"],
        "local.srt", { type: "application/x-subrip" }));
    await waitFor(() =>
      expect(screen.getByText(/SRT 자막 1개 구간을 로컬로 불러왔습니다/)).toBeInTheDocument());
    expect(screen.getByText("<script>not executed</script>")).toBeInTheDocument();
    expect(view.container.querySelector("script")).toBeNull();
  });
  it("shows a local video title, collapses provenance, and navigates only filtered evidence", async () => {
    const user = userEvent.setup();
    const fixture = g2gFixture();
    fixture.questions[1].result = {
      status: "APPROVE", finalVerdict: "SUPPORTED", operatorViewedSource: true,
      finalAnswerText: "두번째 합성 근거",
      finalEvidence: [{
        modality: "AUDIO", localStartMs: 178000, localEndMs: 179000,
        observationNote: "두번째 장면에서 합성 발화가 들린다.",
      }],
    };
    render(<VideoEvidenceExplorerPage />);
    await user.upload(screen.getByLabelText("로컬 영상 파일"),
      new File(["fake video bytes"], "local-movie-title.mp4", { type: "video/mp4" }));
    const video = await screen.findByLabelText("선택한 로컬 영상") as HTMLVideoElement;
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
    expect(screen.getByRole("heading", { name: "local-movie-title" })).toBeInTheDocument();
    await user.upload(screen.getByLabelText("G2-G 운영자 판정 JSON"),
      new File([JSON.stringify(fixture)], "operator.json", { type: "application/json" }));
    await waitFor(() => expect(screen.getByText(/운영자 판정 기록 2문항을 불러왔습니다/)).toBeInTheDocument());
    const details = screen.getByText("근거 출처 및 확인 범위").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "이전 근거" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "다음 근거" }));
    expect(video.currentTime).toBe(88.011);
    await user.click(screen.getByRole("button", { name: "다음 근거" }));
    expect(video.currentTime).toBe(178);
    expect(screen.getByRole("button", { name: "다음 근거" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "이전 근거" }));
    expect(video.currentTime).toBe(88.011);
    await user.selectOptions(screen.getByLabelText("근거 유형"), "AUDIO");
    await user.click(screen.getByRole("button", { name: "다음 근거" }));
    expect(video.currentTime).toBe(178);
    expect(screen.getByRole("button", { name: "이전 근거" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 근거" })).toBeDisabled();
  });

});
