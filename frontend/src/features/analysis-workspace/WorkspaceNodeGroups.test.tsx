import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceHero } from "./WorkspaceHero";
import { WORKSPACE_NODE_GROUPS_KEY } from "./workspaceNodeGroups";
import {
  addWorkspaceUrlTargets, workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";

function sample(count: number) {
  return addWorkspaceUrlTargets([], Array.from({ length: count },
    (_, index) => "https://youtu.be/A" + String(index).padStart(10, "0"),
  ).join("\n")).targets;
}
function Harness({ initial }: { initial: readonly WorkspaceUrlTarget[] }) {
  const [targets, setTargets] = useState(initial);
  return (
    <div>
      <WorkspaceHero targets={targets} onAddUrls={raw => {
        const result = addWorkspaceUrlTargets(targets, raw);
        setTargets(result.targets);
        return result;
      }} onRemoveTarget={key => setTargets(items =>
        items.filter(item => workspaceUrlTargetKey(item) !== key))}/>
      <output data-testid="url-count">{targets.length}</output>
    </div>
  );
}
async function enterFocus(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "전체 화면 집중 모드" }));
  return screen.getByRole("dialog", { name: "그래프 집중 탐색" });
}
async function makeGroup(
  user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement,
  first: string, second: string, name = "검토 묶음",
) {
  await user.click(within(dialog).getByRole("button", { name: "그룹 선택 모드" }));
  await user.click(within(dialog).getByRole("button", { name: "그룹용 영상 " + first + " 선택" }));
  await user.click(within(dialog).getByRole("button", { name: "그룹용 영상 " + second + " 선택" }));
  await user.type(within(dialog).getByRole("textbox", { name: "새 그룹 이름" }), name);
  await user.selectOptions(within(dialog).getByRole("combobox", { name: "새 그룹 색상" }), "teal");
  await user.click(within(dialog).getByRole("button", { name: "그룹 만들기" }));
}

afterEach(() => {
  sessionStorage.clear();
  document.body.style.overflow = "";
});

describe("UI-R04-K — grouped canvas and fullscreen dock regressions", () => {
  it("manually groups, folds and expands, reveals dock focus, persists and dissolves", async () => {
    const user = userEvent.setup();
    const targets = sample(3);
    const view = render(<Harness initial={targets}/>);
    const dialog = await enterFocus(user);
    await makeGroup(user, dialog, "A0000000000", "A0000000001");
    let canvas = within(dialog).getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    const hub = canvas.querySelector<HTMLButtonElement>(".workspace-url-canvas__group-hub");
    expect(hub).toHaveAttribute("aria-expanded", "true");
    expect(hub).toHaveTextContent("검토 묶음");
    expect(within(canvas).getByRole("button", { name: "등록된 영상 A0000000000 선택" }))
      .toBeInTheDocument();
    expect(canvas.querySelectorAll("line")).toHaveLength(0);
    await user.click(hub!);
    expect(hub).toHaveAttribute("aria-expanded", "false");
    expect(within(canvas).queryByRole("button", { name: "등록된 영상 A0000000000 선택" }))
      .not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "대상 목록" }));
    const list = within(dialog).getByRole("complementary", { name: "도킹 대상 목록" });
    await user.click(within(list).getByRole("button", {
      name: "대상 선택 영상 A0000000000",
    }));
    expect(within(canvas).getByRole("button", { name: "등록된 영상 A0000000000 선택" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).toContain("검토 묶음");
    await user.click(within(dialog).getByRole("button", { name: "집중 모드 종료" }));
    const heroCanvas = screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    expect(heroCanvas.querySelector(".workspace-url-canvas__group-hub")).toHaveTextContent("검토 묶음");

    view.unmount();
    render(<Harness initial={targets}/>);
    expect(screen.getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" })
      .querySelector(".workspace-url-canvas__group-hub")).toHaveTextContent("검토 묶음");
    const reopened = await enterFocus(user);
    await user.click(within(reopened).getByRole("button", { name: "그룹 1개" }));
    await user.click(within(reopened).getByRole("button", { name: "그룹 검토 묶음 해제" }));
    expect(within(reopened).getByRole("button", { name: "그룹 0개" })).toBeInTheDocument();
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).toBeNull();
    expect(screen.getByTestId("url-count")).toHaveTextContent("3");
  });

  it("renames, recolors, searches and moves group by keyboard and pointer", async () => {
    const user = userEvent.setup();
    const dialog = await enterFocusAfterRender(user);
    await makeGroup(user, dialog, "A0000000000", "A0000000001");
    await user.click(within(dialog).getByRole("button", { name: "그룹 검토 묶음 이름 변경" }));
    const newName = within(dialog).getByRole("textbox", { name: "그룹 검토 묶음 새 이름" });
    await user.clear(newName);
    await user.type(newName, "즐겨찾기");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "그룹 즐겨찾기 색상" }), "violet",
    );
    await user.type(within(dialog).getByRole("searchbox", { name: "그룹 검색" }), "즐겨");
    expect(within(dialog).getByText(/검색 결과 1\/1/)).toBeInTheDocument();
    const hub = dialog.querySelector<HTMLButtonElement>(".workspace-url-canvas__group-hub");
    expect(hub?.closest(".workspace-url-canvas__cluster"))
      .toHaveClass("is-violet");
    hub?.focus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).toContain('"offsetX":20');
    fireEvent.pointerDown(hub!, { pointerId: 7, button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(hub!, { pointerId: 7, clientX: 230, clientY: 220 });
    fireEvent.pointerUp(hub!, { pointerId: 7, clientX: 230, clientY: 220 });
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).toContain('"offsetX":50');
    await user.click(within(dialog).getByRole("button", {
      name: "그룹 즐겨찾기 위치 초기화",
    }));
    expect(sessionStorage.getItem(WORKSPACE_NODE_GROUPS_KEY)).toContain('"offsetX":0');
    await user.click(within(dialog).getByRole("button", { name: "그룹 즐겨찾기 찾기" }));
    expect(hub).toBeInTheDocument();
  });

  it("lets group candidates span pages and keeps navigation over all ungrouped nodes", async () => {
    const user = userEvent.setup();
    render(<Harness initial={sample(27)}/>);
    const dialog = await enterFocus(user);
    const canvas = within(dialog).getByRole("region", { name: "URL 등록 대상 전체 화면 탐색" });
    await user.click(within(dialog).getByRole("button", { name: "그룹 선택 모드" }));
    expect(within(canvas).getAllByRole("button", { name: /그룹용 영상 .* 선택/ }))
      .toHaveLength(24);
    await user.click(within(dialog).getByRole("button", { name: "다음" }));
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    await user.click(within(canvas).getByRole("button", {
      name: "그룹용 영상 A0000000000 선택",
    }));
    await user.click(within(canvas).getByRole("button", {
      name: "그룹용 영상 A0000000001 선택",
    }));
    await user.type(within(dialog).getByRole("textbox", { name: "새 그룹 이름" }), "뒤쪽 묶음");
    await user.click(within(dialog).getByRole("button", { name: "그룹 만들기" }));
    await user.type(within(dialog).getByRole("searchbox", { name: "그룹 검색" }), "뒤쪽");
    await user.click(within(dialog).getByRole("button", { name: "그룹 뒤쪽 묶음 찾기" }));
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
    expect(canvas.querySelector(".workspace-url-canvas__group-hub"))
      .toHaveTextContent("뒤쪽 묶음");
  });
});

async function enterFocusAfterRender(user: ReturnType<typeof userEvent.setup>) {
  render(<Harness initial={sample(3)}/>);
  return enterFocus(user);
}
