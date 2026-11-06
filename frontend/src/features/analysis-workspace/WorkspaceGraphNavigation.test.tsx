import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WorkspaceUrlCanvas } from "./WorkspaceUrlCanvas";
import { createWorkspaceNodeGroup } from "./workspaceNodeGroups";
import {
  addWorkspaceUrlTargets, workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";

const sample = (count: number) => addWorkspaceUrlTargets([],
  Array.from({ length: count }, (_, i) =>
    "https://youtu.be/A" + String(i).padStart(10, "0")).join("\n")).targets;

describe("UI-R04-L — integrated graph search, navigation and minimap", () => {
  it("searches across 24-item pages, highlights results and centers with back/forward", async () => {
    const user = userEvent.setup();
    render(<WorkspaceUrlCanvas targets={sample(27)}/>);
    const canvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    const search = within(canvas).getByRole("searchbox", { name: "그래프 통합 검색" });
    expect(within(canvas).getByRole("region", { name: "그래프 미니맵" })).toBeInTheDocument();
    expect(within(canvas).getByRole("button", { name: "이전 탐색" })).toBeDisabled();
    await user.type(search, "A0000000000");
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    expect(within(canvas).getByRole("button", {
      name: "등록된 영상 A0000000000 선택",
    })).toHaveClass("is-search-hit");
    await waitFor(() => {
      expect(within(canvas).getByLabelText("노드 탐색 캔버스")
        .querySelector(".workspace-url-canvas__nodes")?.getAttribute("style"))
        .not.toContain("translate(0px, 0px)");
    });
    await user.click(within(canvas).getByRole("button", {
      name: "검색 결과 대상 A0000000000 이동",
    }));
    await user.clear(search);
    await user.type(search, "A0000000026");
    expect(within(canvas).getByText("1 / 2")).toBeInTheDocument();
    await user.click(within(canvas).getByRole("button", {
      name: "검색 결과 대상 A0000000026 이동",
    }));
    expect(within(canvas).getByRole("button", { name: "이전 탐색" })).not.toBeDisabled();
    await user.click(within(canvas).getByRole("button", { name: "이전 탐색" }));
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    expect(within(canvas).getByRole("button", {
      name: "등록된 영상 A0000000000 선택",
    })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(canvas).getByRole("button", { name: "다음 탐색" }));
    expect(within(canvas).getByText("1 / 2")).toBeInTheDocument();
    expect(within(canvas).getByRole("button", {
      name: "등록된 영상 A0000000026 선택",
    })).toHaveAttribute("aria-pressed", "true");
    expect(within(canvas).getByText(/실데이터 분석이나 연결 관계의 증거가 아닙니다/))
      .toBeInTheDocument();
  });

  it("finds user-created group and a collapsed member without inventing edges", async () => {
    const user = userEvent.setup();
    const targets = sample(4);
    const keys = targets.map(workspaceUrlTargetKey);
    const group = createWorkspaceNodeGroup(
      [], targets, keys.slice(0, 2), "마케팅 검토 묶음", "teal",
    )[0];
    render(<WorkspaceUrlCanvas targets={targets} groups={[{...group, collapsed: true}]}/>);
    const canvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    const search = within(canvas).getByRole("searchbox", { name: "그래프 통합 검색" });
    await user.type(search, "마케팅");
    const hub = within(canvas).getByRole("button", { name: "그룹 마케팅 검토 묶음 펼치기" });
    expect(hub.closest(".workspace-url-canvas__cluster")).toHaveClass("is-search-hit");
    await user.click(within(canvas).getByRole("button", {
      name: "검색 결과 그룹 마케팅 검토 묶음 이동",
    }));
    await user.clear(search);
    await user.type(search, "A0000000000");
    expect(within(canvas).getByRole("button", {
      name: "등록된 영상 A0000000000 선택",
    })).toHaveAttribute("aria-pressed", "true");
    expect(within(canvas).getByRole("button", {
      name: "그룹 마케팅 검토 묶음 접기",
    })).toHaveAttribute("aria-expanded", "true");
    await user.click(within(canvas).getByRole("button", {
      name: "미니맵 그룹 마케팅 검토 묶음 이동",
    }));
    expect(within(canvas).getByRole("button", {
      name: "그룹 마케팅 검토 묶음 펼치기",
    })).toHaveAttribute("aria-expanded", "false");
    expect(canvas.querySelectorAll("line")).toHaveLength(0);
  });

  it("tracks controlled external selections and honors selection centering", async () => {
    const targets = sample(3);
    const first = workspaceUrlTargetKey(targets[0]);
    const second = workspaceUrlTargetKey(targets[1]);
    function Harness() {
      const [selected, setSelected] = useState<string | null>(null);
      return (
        <div>
          <button type="button" onClick={() => setSelected(first)}>외부 첫 번째 선택</button>
          <button type="button" onClick={() => setSelected(second)}>외부 두 번째 선택</button>
          <WorkspaceUrlCanvas targets={targets} focusedKey={selected} onFocusChange={setSelected}/>
          <output data-testid="selected-target">{selected}</output>
        </div>
      );
    }
    const user = userEvent.setup();
    render(<Harness/>);
    await user.click(screen.getByRole("button", { name: "외부 첫 번째 선택" }));
    await user.click(screen.getByRole("button", { name: "외부 두 번째 선택" }));
    const canvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    expect(within(canvas).getByRole("button", { name: "이전 탐색" })).not.toBeDisabled();
    await user.click(within(canvas).getByRole("button", { name: "이전 탐색" }));
    expect(screen.getByTestId("selected-target")).toHaveTextContent(first);
    await user.click(within(canvas).getByRole("button", { name: "선택 중심 맞춤" }));
    await waitFor(() =>
      expect(canvas.querySelector(".workspace-url-canvas__nodes")?.getAttribute("style"))
        .toContain("translate("),
    );
  });

  it("shows every graph page in the minimap and navigates across them", async () => {
    const user = userEvent.setup();
    render(<WorkspaceUrlCanvas targets={sample(27)}/>);
    const canvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    const minimap = within(canvas).getByRole("region", { name: "그래프 미니맵" });
    expect(within(minimap).getAllByRole("button")).toHaveLength(27);
    const lastPagePin = within(minimap).getByRole("button", {
      name: "미니맵 영상 A0000000000 이동",
    });
    expect(lastPagePin).toHaveAttribute("data-page", "2");
    expect(minimap.querySelectorAll(".workspace-url-canvas__minimap-page")).toHaveLength(2);
    await user.click(lastPagePin);
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    expect(minimap.querySelector(".workspace-url-canvas__minimap-page.is-current"))
      .toHaveStyle({ left: "50%" });
    expect(within(canvas).getByRole("button", {
      name: "등록된 영상 A0000000000 선택",
    })).toHaveAttribute("aria-pressed", "true");
  });

  it("hides and restores the minimap without changing graph registration", async () => {
    const user = userEvent.setup();
    render(<WorkspaceUrlCanvas targets={sample(2)}/>);
    const canvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    const mapButton = within(canvas).getByRole("button", { name: "미니맵", pressed: true });
    await user.click(mapButton);
    expect(within(canvas).queryByRole("region", { name: "그래프 미니맵" }))
      .not.toBeInTheDocument();
    await user.click(mapButton);
    const minimap = within(canvas).getByRole("region", { name: "그래프 미니맵" });
    expect(within(minimap).getAllByRole("button")).toHaveLength(2);
    expect(within(canvas).getAllByRole("button", {
      name: /등록된 영상 .* 선택/,
    })).toHaveLength(2);
  });
});
