import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { WorkspaceHero } from "./WorkspaceHero";
import {
  WORKSPACE_GRAPH_BOOKMARKS_KEY, writeGraphBookmarks,
} from "./workspaceGraphBookmarks";
import {
  createWorkspaceNodeGroup, writeWorkspaceNodeGroups,
} from "./workspaceNodeGroups";
import { addWorkspaceUrlTargets, workspaceUrlTargetKey,
  type WorkspaceUrlTarget } from "./workspaceUrlTargets";

function sample(...items: string[]) {
  return addWorkspaceUrlTargets([], items.join("\n")).targets;
}
const a = "https://youtu.be/A0000000000";
const b = "https://youtu.be/A0000000001";
const channel = "https://www.youtube.com/@samplecreator";

function Harness({ initial }: { initial: readonly WorkspaceUrlTarget[] }) {
  const [targets, setTargets] = useState(initial);
  return (
    <div>
      <WorkspaceHero targets={targets}
        onAddUrls={raw => {
          const result = addWorkspaceUrlTargets(targets, raw);
          setTargets(result.targets);
          return result;
        }}
        onRemoveTarget={key => setTargets(current =>
          current.filter(target => workspaceUrlTargetKey(target) !== key))}/>
      <output data-testid="registered">{targets.length}</output>
    </div>
  );
}
afterEach(() => {
  sessionStorage.clear();
  document.body.style.overflow = "";
});
async function focus(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "전체 화면 집중 모드" }));
  return screen.getByRole("dialog", { name: "그래프 집중 탐색" });
}

describe("UI-R04-M — shared local graph bookmarks and non-destructive filters", () => {
  it("bookmarks a selected video, reuses the selection in both layouts and restores on reload", async () => {
    const user = userEvent.setup();
    const original = sample(a, b, channel);
    const page = render(<Harness initial={original}/>);
    const dialog = await focus(user);
    const canvas = within(dialog).getByRole("region",
      { name: "URL 등록 대상 전체 화면 탐색" });
    const star = within(canvas).getByRole("button", { name: "선택 북마크 추가" });
    expect(star).toBeDisabled();
    await user.click(within(canvas).getByRole("button",
      { name: "등록된 영상 A0000000000 선택" }));
    await user.click(star);
    expect(within(canvas).getByRole("button", { name: "선택 북마크 해제" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(canvas).getByRole("button",
      { name: "등록된 영상 A0000000000 선택" })).toHaveClass("is-bookmarked");
    expect(sessionStorage.getItem(WORKSPACE_GRAPH_BOOKMARKS_KEY))
      .toContain("VIDEO:A0000000000");
    await user.click(within(canvas).getByRole("button", { name: "북마크 1개" }));
    expect(within(canvas).getByRole("region", { name: "북마크 목록" }))
      .toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "집중 모드 종료" }));
    const hero = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    expect(within(hero).getByRole("button",
      { name: "등록된 영상 A0000000000 선택" })).toHaveClass("is-bookmarked");

    page.unmount();
    render(<Harness initial={original}/>);
    const restored = screen.getByRole("region",
      { name: "URL 등록 대상 전체 화면 탐색" });
    expect(within(restored).getByRole("button",
      { name: "등록된 영상 A0000000000 선택" })).toHaveClass("is-bookmarked");
    await user.click(within(restored).getByRole("button", { name: "북마크 1개" }));
    await user.click(within(restored).getByRole("button",
      { name: "북마크 A0000000000 제거" }));
    await waitFor(() => expect(sessionStorage.getItem(WORKSPACE_GRAPH_BOOKMARKS_KEY))
      .toBeNull());
    expect(within(restored).getByRole("button",
      { name: "등록된 영상 A0000000000 선택" })).not.toHaveClass("is-bookmarked");
  });

  it("browses video/channel/group/bookmark results without hiding registered graph nodes", async () => {
    const user = userEvent.setup();
    const targets = sample(a, b, channel);
    const ids = targets.map(workspaceUrlTargetKey);
    const groups = createWorkspaceNodeGroup([], targets, ids.slice(0, 2),
      "선택 보관 그룹", "teal");
    expect(writeWorkspaceNodeGroups(sessionStorage, groups, targets)).toBe(true);
    expect(writeGraphBookmarks(sessionStorage, [
      { kind: "group", key: groups[0].id },
      { kind: "target", key: ids[2] },
    ], targets, groups)).toBe(true);
    render(<Harness initial={targets}/>);
    const canvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    const scope = within(canvas).getByRole("combobox", { name: "탐색 결과 유형" });
    expect(within(canvas).queryByRole("region", { name: "통합 검색 결과" }))
      .not.toBeInTheDocument();
    await user.selectOptions(scope, "group");
    let results = within(canvas).getByRole("region", { name: "통합 검색 결과" });
    expect(within(results).getByRole("button",
      { name: "검색 결과 그룹 선택 보관 그룹 이동" })).toBeInTheDocument();
    await user.selectOptions(scope, "channel");
    results = within(canvas).getByRole("region", { name: "통합 검색 결과" });
    expect(within(results).getByRole("button",
      { name: "검색 결과 대상 @samplecreator 이동" })).toBeInTheDocument();
    await user.selectOptions(scope, "video");
    results = within(canvas).getByRole("region", { name: "통합 검색 결과" });
    expect(within(results).getAllByRole("button",
      { name: /검색 결과 대상 A000000000\d 이동/ })).toHaveLength(2);
    await user.selectOptions(scope, "bookmarked");
    results = within(canvas).getByRole("region", { name: "통합 검색 결과" });
    expect(within(results).getAllByRole("button")).toHaveLength(2);
    expect(canvas.querySelectorAll(".workspace-url-canvas__cluster")).toHaveLength(1);
    expect(canvas.querySelectorAll(".workspace-url-canvas__node")).toHaveLength(3);
    await user.selectOptions(scope, "all");
    expect(within(canvas).queryByRole("region", { name: "통합 검색 결과" }))
      .not.toBeInTheDocument();
  });

  it("jumps to a bookmarked node on a different graph page, and prunes deleted targets", async () => {
    const user = userEvent.setup();
    const targets = sample(...Array.from({length:27},
      (_, i) => "https://youtu.be/A" + String(i).padStart(10, "0")));
    render(<Harness initial={targets}/>);
    const dialog = await focus(user);
    const canvas = within(dialog).getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    await user.click(within(canvas).getByRole("button", { name: "다음" }));
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    await user.click(within(canvas).getByRole("button",
      { name: "등록된 영상 A0000000000 선택" }));
    await user.click(within(canvas).getByRole("button", { name: "선택 북마크 추가" }));
    await user.click(within(canvas).getByRole("button", { name: "화면 맞춤" }));
    await user.click(within(canvas).getByRole("button", { name: "이전" }));
    expect(within(canvas).getByText("1 / 2")).toBeInTheDocument();
    await user.click(within(canvas).getByRole("button", { name: "북마크 1개" }));
    await user.click(within(canvas).getByRole("button",
      { name: "북마크 A0000000000 이동" }));
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "이 등록 대상 제거" }));
    expect(screen.getByTestId("registered")).toHaveTextContent("26");
    await waitFor(() =>
      expect(sessionStorage.getItem(WORKSPACE_GRAPH_BOOKMARKS_KEY)).toBeNull());
  });
});
