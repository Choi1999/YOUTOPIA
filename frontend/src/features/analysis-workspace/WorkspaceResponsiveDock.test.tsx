import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceFocusMode } from "./WorkspaceFocusMode";
import { addWorkspaceUrlTargets, type WorkspaceUrlTarget } from "./workspaceUrlTargets";
import { focusDockPresentationMode } from "./workspaceFocusLayout";

const targets=addWorkspaceUrlTargets([],
  "https://youtu.be/Ab0_-123xyz\nhttps://youtube.com/@samplecreator").targets;

function mount(items:readonly WorkspaceUrlTarget[]=targets) {
  return render(<WorkspaceFocusMode
    targets={items}
    onAddUrls={input=>addWorkspaceUrlTargets(items,input)}
    onRemove={()=>{}}
    onExit={()=>{}}
  />);
}

function setWidth(width:number) {
  Object.defineProperty(window,"innerWidth",{configurable:true,value:width});
  fireEvent.resize(window);
}

afterEach(()=>{
  sessionStorage.clear();
  document.body.style.overflow="";
  setWidth(1024);
});

describe("UI-R04-AD-4 — coherent desktop/tablet/mobile dock transitions",()=>{
  it("uses one overlay at 820px, retains selected target, returns to columns at desktop",async()=>{
    setWidth(820);
    const user=userEvent.setup();
    mount();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const graph=within(dialog).getByRole("region",{
      name:"URL 등록 대상 전체 화면 탐색",
    });
    const body=dialog.querySelector(".workspace-focus__body");
    expect(body).toHaveAttribute("data-dock-mode","overlay");
    expect(focusDockPresentationMode(820)).toBe("overlay");
    await user.click(within(graph).getByRole("button",{
      name:"등록된 영상 Ab0_-123xyz 선택",
    }));
    expect(body).toHaveAttribute("data-layout","detail");
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(detail).getByText("등록 식별자: Ab0_-123xyz"))
      .toBeInTheDocument();

    // Show list: detail overlay must close, graph remains available.
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    expect(body).toHaveAttribute("data-layout","list");
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    expect(within(dialog).queryByRole("complementary",{name:"도킹 선택 상세"}))
      .not.toBeInTheDocument();
    await user.click(within(list).getByRole("button",{
      name:"대상 선택 영상 Ab0_-123xyz",
    }));
    expect(body).toHaveAttribute("data-layout","detail");
    expect(within(graph).getByRole("button",{
      name:"등록된 영상 Ab0_-123xyz 선택",
    })).toHaveAttribute("aria-pressed","true");

    // Opening list on desktop allows a true three-column dock layout.
    setWidth(1440);
    expect(body).toHaveAttribute("data-dock-mode","columns");
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    expect(body).toHaveAttribute("data-layout","both");
    expect(within(dialog).getByRole("complementary",{name:"도킹 선택 상세"}))
      .toBeInTheDocument();

    // Device rotation/resize returns to exactly one visible overlay.
    setWidth(820);
    expect(body).toHaveAttribute("data-dock-mode","overlay");
    expect(body).toHaveAttribute("data-layout","detail");
    expect(within(dialog).queryByRole("complementary",{name:"도킹 대상 목록"}))
      .not.toBeInTheDocument();
    expect(within(dialog).getByText("등록 식별자: Ab0_-123xyz"))
      .toBeInTheDocument();
  });

  it("on mobile a list selection replaces the sheet rather than overlapping two panels",async()=>{
    setWidth(390);
    const user=userEvent.setup();
    mount();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const body=dialog.querySelector(".workspace-focus__body");
    expect(body).toHaveAttribute("data-dock-mode","overlay");
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    expect(body).toHaveAttribute("data-layout","list");
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    await user.click(within(list).getByRole("button",{
      name:"대상 선택 채널 핸들 @samplecreator",
    }));
    expect(body).toHaveAttribute("data-layout","detail");
    expect(within(dialog).queryByRole("complementary",{name:"도킹 대상 목록"}))
      .not.toBeInTheDocument();
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(detail).getByText("등록 식별자: @samplecreator"))
      .toBeInTheDocument();
    expect(within(detail).getByText(/채널 정보가 아직 제공되지 않습니다/))
      .toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("breakpoints match CSS and do not allow columns with an invalid viewport",()=>{
    expect(focusDockPresentationMode(1101)).toBe("columns");
    expect(focusDockPresentationMode(1100)).toBe("overlay");
    expect(focusDockPresentationMode(720)).toBe("overlay");
    expect(focusDockPresentationMode(NaN)).toBe("overlay");
    expect(focusDockPresentationMode(-1)).toBe("overlay");
  });
});
