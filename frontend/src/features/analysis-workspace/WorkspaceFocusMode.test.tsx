import {useState} from "react";
import {fireEvent,render,screen,within} from "@testing-library/react";
import {FOCUS_DOCK_LAYOUT_KEY} from "./workspaceFocusLayout";
import userEvent from "@testing-library/user-event";
import {afterEach,describe,expect,it} from "vitest";

import {WorkspaceHero} from "./WorkspaceHero";
import {WorkspaceUrlCanvas} from "./WorkspaceUrlCanvas";
import {
  addWorkspaceUrlTargets, workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";

function sample(...urls:string[]) {
  return addWorkspaceUrlTargets([],urls.join("\n")).targets;
}

function Harness({initial}: {initial:readonly WorkspaceUrlTarget[]}) {
  const [targets,setTargets]=useState(initial);
  return (
    <div>
      <WorkspaceHero targets={targets}
        onAddUrls={raw=>{
          const result=addWorkspaceUrlTargets(targets,raw);
          setTargets(result.targets);
          return result;
        }}
        onRemoveTarget={key=>setTargets(items=>
          items.filter(item=>workspaceUrlTargetKey(item)!==key))}/>
      <output data-testid="registered-count">{targets.length}</output>
    </div>
  );
}

afterEach(()=>{document.body.style.overflow="";sessionStorage.clear();});

describe("UI-R04-C — opt-in fullscreen graph with adaptive docks",()=>{
  it("opens the viewport dialog, redistributes dock space and restores focus on Escape",async()=>{
    const user=userEvent.setup();
    const before=document.body.style.overflow;
    render(<Harness initial={sample(
      "https://youtu.be/Ab0_-123xyz",
      "https://www.youtube.com/@SomeCreator",
    )}/>);
    const launcher=screen.getByRole("button",{name:"전체 화면 집중 모드"});
    await user.click(launcher);
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(dialog).toHaveAttribute("aria-modal","true");
    expect(document.body.style.overflow).toBe("hidden");
    const body=dialog.querySelector(".workspace-focus__body");
    expect(body).toHaveAttribute("data-layout","none");
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    expect(body).toHaveAttribute("data-layout","list");
    const list=within(dialog).getByRole("complementary",{name:"도킹 대상 목록"});
    await user.click(within(list).getByRole("button",{name:"대상 선택 영상 Ab0_-123xyz"}));
    expect(body).toHaveAttribute("data-layout","both");
    const details=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(details).getByText("Ab0_-123xyz")).toBeInTheDocument();
    expect(within(details).getByText(/분석 정보는 아직 제공되지 않습니다/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button",{name:"등록된 영상 Ab0_-123xyz 선택"}))
      .toHaveAttribute("aria-pressed","true");
    await user.click(within(list).getByRole("button",{name:"대상 목록 닫기"}));
    expect(body).toHaveAttribute("data-layout","detail");
    await user.click(within(dialog).getByRole("button",{name:"선택 상세 닫기"}));
    expect(body).toHaveAttribute("data-layout","none");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog",{name:"그래프 집중 탐색"})).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe(before);
    expect(launcher).toHaveFocus();
  });

  it("registers a new URL inside focus mode without changing the original A/B fixture",async()=>{
    const user=userEvent.setup();
    render(<Harness initial={sample("https://youtu.be/Ab0_-123xyz")}/>);
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    const input=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    await user.type(input,"https://www.youtube.com/@AnotherCreator");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    expect(screen.getByTestId("registered-count")).toHaveTextContent("2");
    expect(within(dialog).getByRole("button",{name:"등록된 채널 @anothercreator 선택"}))
      .toBeInTheDocument();
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(detail).getByText(/채널 이름과 프로필은 아직 확인되지 않았습니다/)).toBeInTheDocument();
    expect(within(dialog).getByText(/신규 1개/)).toBeInTheDocument();
  });

  it("removes an existing target and exits safely when no registration remains",async()=>{
    const user=userEvent.setup();
    render(<Harness initial={sample("https://youtu.be/Ab0_-123xyz")}/>);
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"등록된 영상 Ab0_-123xyz 선택"}));
    await user.click(within(dialog).getByRole("button",{name:"이 등록 대상 제거"}));
    expect(screen.getByTestId("registered-count")).toHaveTextContent("0");
    expect(screen.queryByRole("dialog",{name:"그래프 집중 탐색"})).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("allows controlled dock focus to show a target beyond the first 24 canvas nodes",()=>{
    const targets=sample(...Array.from({length:27},(_,i)=>
      "https://youtu.be/"+"A"+String(i).padStart(10,"0")));
    render(<WorkspaceUrlCanvas targets={targets} focusedKey="VIDEO:A0000000000"
      onFocusChange={()=>{}}/>);
    const canvas=screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    expect(within(canvas).getByRole("button",{name:"등록된 영상 A0000000000 선택"}))
      .toHaveAttribute("aria-pressed","true");
    expect(within(canvas).getByText("2 / 2")).toBeInTheDocument();
  });

  it("resizes both docks by keyboard, restores within the tab and resets to automatic layout",async()=>{
    const user=userEvent.setup();
    const view=render(<Harness initial={sample("https://youtu.be/Ab0_-123xyz")}/>);
    const launcher=screen.getByRole("button",{name:"전체 화면 집중 모드"});
    await user.click(launcher);
    let dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    await user.click(within(dialog).getByRole("button",{name:"선택 상세"}));
    const list=within(dialog).getByRole("separator",{name:"대상 목록 너비 조절"});
    const detail=within(dialog).getByRole("separator",{name:"선택 상세 너비 조절"});
    list.focus();
    await user.keyboard("{ArrowRight}");
    expect(dialog.querySelector(".workspace-focus__body"))
      .toHaveAttribute("data-layout","both");
    expect(sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY)).toContain('"version":1');
    expect(list).toHaveAttribute("aria-valuemin","225");
    detail.focus();
    await user.keyboard("{End}");
    expect(detail).toHaveAttribute("aria-valuenow",detail.getAttribute("aria-valuemax"));
    const persisted=sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY);
    expect(persisted).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(launcher);
    dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    await user.click(within(dialog).getByRole("button",{name:"선택 상세"}));
    expect(dialog.querySelector(".workspace-focus__body")?.getAttribute("style"))
      .toContain("--focus-list-width:");
    expect(sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY)).toBe(persisted);
    await user.click(within(dialog).getByRole("button",{name:"레이아웃 기본값 복원"}));
    expect(sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY)).toBeNull();
    expect(dialog.querySelector(".workspace-focus__body")?.getAttribute("style"))
      .not.toContain("--focus-list-width:");
    view.unmount();
  });

  it("supports pointer resizing, then removes splitters when docks close",async()=>{
    const user=userEvent.setup();
    render(<Harness initial={sample("https://youtu.be/Ab0_-123xyz")}/>);
    await user.click(screen.getByRole("button",{name:"전체 화면 집중 모드"}));
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.click(within(dialog).getByRole("button",{name:"대상 목록"}));
    const handle=within(dialog).getByRole("separator",{name:"대상 목록 너비 조절"});
    fireEvent.pointerDown(handle,{pointerId:3,button:0,clientX:350});
    fireEvent.pointerMove(handle,{pointerId:3,clientX:390});
    fireEvent.pointerUp(handle,{pointerId:3,clientX:390});
    expect(sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY)).toContain('"list":320');
    await user.click(within(dialog).getByRole("button",{name:"대상 목록 닫기"}));
    expect(within(dialog).queryAllByRole("separator")).toHaveLength(0);
    expect(sessionStorage.getItem(FOCUS_DOCK_LAYOUT_KEY)).not.toBeNull();
  });

});
