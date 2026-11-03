import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ChannelComparisonPage } from "../../pages/analysis/ChannelComparisonPage";
import { AnalysisRepositoryProvider } from "./data/AnalysisRepositoryContext";
import type { AnalysisRepository } from "./data/AnalysisRepository";
import { demoAnalysisRepository } from "./data/DemoAnalysisRepository";
import { demoChannelSelection, demoChannelBSelection } from "./data/demoChannelSelection";

const A = demoChannelSelection.channelId, B = demoChannelBSelection.channelId;
function show(path = "/analysis/youtube/channels/compare",
  repo: AnalysisRepository = demoAnalysisRepository) {
  return render(
    <AnalysisRepositoryProvider repository={repo}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/analysis/youtube/channels/compare"
            element={<ChannelComparisonPage/>}/>
          <Route path="/analysis/youtube/channel/:channelId"
            element={<p>채널 상세 목적지</p>}/>
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}

describe("YU-47 — two explicit synthetic channels comparison Web UI", () => {
  it("renders both channel denominators and factual B − A differences", async () => {
    show();
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
    expect(screen.getByText("분류 완료 160건 · 미분류 40건")).toBeInTheDocument();
    expect(screen.getByText("분류 완료 140건 · 미분류 40건")).toBeInTheDocument();
    expect(screen.getByText("채널 A 51.25% · 채널 B 34.29%"))
      .toBeInTheDocument();
    const topics=screen.getByRole("list", {name:"채널별 주제 차이"});
    expect(within(topics).getByText("QUALITY")).toBeInTheDocument();
    expect(within(topics).getByText("B − A +43건")).toBeInTheDocument();
    expect(screen.getByText(/실제 YouTube 채널 소속/)).toBeInTheDocument();
  });

  it("swaps channels and reverses signed percentage-point differences", async () => {
    const user=userEvent.setup();show();
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
    await user.click(screen.getByRole("button", {name:"A/B 순서 바꾸기"}));
    expect(await screen.findByText("채널 A 34.29% · 채널 B 51.25%"))
      .toBeInTheDocument();
    expect(screen.getByText("B − A -43건")).toBeInTheDocument();
  });

  it("does not invent results for a valid but unregistered channel", async () => {
    show("/analysis/youtube/channels/compare?channel="+A+
      "&channel=UC"+"Z".repeat(22));
    expect(await screen.findByText(/비교 제한: NOT_READY/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();
  });

  it("rejects duplicate, invalid and additional query parameters without fallback", () => {
    for (const query of [
      "?channel="+A+"&channel="+A,
      "?channel=bad&channel="+B,
      "?channel="+A+"&channel="+B+"&token=secret",
    ]) {
      const view=show("/analysis/youtube/channels/compare"+query);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "서로 다른 유효한 CHANNEL ID");
      expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
        .not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("blocks the entire comparison when constituent VIDEO is missing", async () => {
    const repo:AnalysisRepository = {
      async getSnapshot(target) {
        if (target.targetId === "Db0_-123xyz") return {kind:"NOT_FOUND"};
        return demoAnalysisRepository.getSnapshot(target);
      },
    };
    show(undefined,repo);
    expect(await screen.findByText(/비교 제한: NOT_READY/))
      .toBeInTheDocument();
    expect(screen.queryByText("B − A +43건")).not.toBeInTheDocument();
  });

  it("links to each CHANNEL and registered topic explorer without unknown data", async () => {
    show();
    const topicLink=await screen.findByRole("link",{name:"QUALITY 상세 탐색"});
    expect(topicLink).toHaveAttribute("href",
      "/analysis/youtube/topics?topic=QUALITY&channel="+A+"&channel="+B);
    const nav=screen.getByRole("navigation",{name:"채널 비교 탐색"});
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
  });
  it("YU-47-QA: preserves channel A when B is still empty in URL", async () => {
    const user = userEvent.setup();
    show("/analysis/youtube/channels/compare?channel="+A+"&channel=");
    const first = screen.getByRole("combobox", {name:"채널 A"});
    const second = screen.getByRole("combobox", {name:"채널 B"});
    expect(first).toHaveValue(A);
    expect(second).toHaveValue("");
    expect(screen.getByText(/채널 A가 선택되었습니다. 비교할 채널 B를 선택하세요/))
      .toBeInTheDocument();
    expect(screen.getByRole("button", {name:"A/B 순서 바꾸기"})).toBeDisabled();
    expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();

    await user.selectOptions(second, B);
    expect(first).toHaveValue(A);
    expect(second).toHaveValue(B);
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
  });

  it("YU-47-QA: starting from two empty URL slots retains A then B", async () => {
    const user = userEvent.setup();
    show("/analysis/youtube/channels/compare?channel=&channel=");
    const first = screen.getByRole("combobox", {name:"채널 A"});
    const second = screen.getByRole("combobox", {name:"채널 B"});
    expect(first).toHaveValue("");
    expect(second).toHaveValue("");
    await user.selectOptions(first, A);
    expect(first).toHaveValue(A);
    expect(second).toHaveValue("");
    expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();
    await user.selectOptions(second, B);
    expect(first).toHaveValue(A);
    expect(second).toHaveValue(B);
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
  });

  it("YU-47-QA: clearing B hides prior comparison while retaining A", async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole("heading", {name:"감성 분포 및 차이"});
    const first=screen.getByRole("combobox", {name:"채널 A"});
    const second=screen.getByRole("combobox", {name:"채널 B"});
    await user.selectOptions(second, "");
    expect(first).toHaveValue(A);
    expect(second).toHaveValue("");
    expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();
    expect(screen.getByText(/채널 A가 선택되었습니다/)).toBeInTheDocument();
  });

  it("YU-47-QA: malformed duplicate query is blocked, but explicit fresh selection recovers", async () => {
    const user = userEvent.setup();
    show("/analysis/youtube/channels/compare?channel="+A+"&channel="+A);
    expect(screen.getByRole("alert")).toHaveTextContent("서로 다른 유효한 CHANNEL ID");
    const first=screen.getByRole("combobox", {name:"채널 A"});
    const second=screen.getByRole("combobox", {name:"채널 B"});
    await user.selectOptions(first, A);
    expect(first).toHaveValue(A);
    expect(second).toHaveValue("");
    await user.selectOptions(second, B);
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
  });

  it("YU-47-QA: preserves B-only selection until channel A is chosen", async () => {
    const user=userEvent.setup();
    show("/analysis/youtube/channels/compare?channel=&channel="+B);
    const first=screen.getByRole("combobox",{name:"채널 A"});
    const second=screen.getByRole("combobox",{name:"채널 B"});
    expect(first).toHaveValue("");
    expect(second).toHaveValue(B);
    expect(screen.getByText(/채널 B가 선택되었습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();
    await user.selectOptions(first,A);
    expect(first).toHaveValue(A);
    expect(second).toHaveValue(B);
    expect(await screen.findByRole("heading",{name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
  });

  it("YU-47-QA-UTM: screenshot URL retains channel A and can select B", async () => {
    const user = userEvent.setup();
    show("/analysis/youtube/channels/compare?channel=" + A +
      "&channel=&utm_source=chatgpt.com");
    const first = screen.getByRole("combobox", {name:"채널 A"});
    const second = screen.getByRole("combobox", {name:"채널 B"});
    expect(first).toHaveValue(A);
    expect(second).toHaveValue("");
    expect(screen.getByText(/채널 A가 선택되었습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();
    await user.selectOptions(second, B);
    expect(first).toHaveValue(A);
    expect(second).toHaveValue(B);
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
  });

  it("YU-47-QA-UTM: completed selected channels retain comparison with UTM metadata", async () => {
    show("/analysis/youtube/channels/compare?channel="+B+"&channel="+A+
      "&utm_source=chatgpt.com&utm_medium=link");
    expect(screen.getByRole("combobox", {name:"채널 A"})).toHaveValue(B);
    expect(screen.getByRole("combobox", {name:"채널 B"})).toHaveValue(A);
    expect(await screen.findByText("채널 A 34.29% · 채널 B 51.25%"))
      .toBeInTheDocument();
  });

  it("YU-47-QA-UTM: attribution-only link uses ordinary default demo pair", async () => {
    show("/analysis/youtube/channels/compare?utm_source=chatgpt.com");
    expect(screen.getByRole("combobox", {name:"채널 A"})).toHaveValue(A);
    expect(screen.getByRole("combobox", {name:"채널 B"})).toHaveValue(B);
    expect(await screen.findByRole("heading", {name:"감성 분포 및 차이"}))
      .toBeInTheDocument();
  });

  it.each([
    "?channel="+A+"&channel="+B+"&secret=token&utm_source=chatgpt.com",
    "?channel="+A+"&channel="+B+"&utm_source=one&utm_source=two",
    "?channel="+A+"&channel="+B+"&utm_source="+"x".repeat(129),
    "?channel="+A+"&channel="+B+"&utm_custom=unexpected",
  ])("YU-47-QA-UTM: unknown, duplicate or oversized parameter fails closed: %s", query => {
    show("/analysis/youtube/channels/compare"+query);
    expect(screen.getByRole("alert")).toHaveTextContent("서로 다른 유효한 CHANNEL ID");
    expect(screen.queryByRole("heading", {name:"감성 분포 및 차이"}))
      .not.toBeInTheDocument();
  });

});
