import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe,expect,it} from "vitest";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";
import {WorkspaceUrlCanvas} from "./WorkspaceUrlCanvas";

const urls=Array.from({length:3},(_,i)=>
  "https://youtu.be/"+"A"+i.toString().padStart(10,"0"));

describe("UI-R04B fullscreen canvas safety and interaction",()=>{
  it("shows all new targets without creating inferred channel edges or analysis",async()=>{
    const user=userEvent.setup();
    const targets=addWorkspaceUrlTargets([],urls.join("\n")).targets;
    render(<WorkspaceUrlCanvas targets={targets}/>);
    const canvas=screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    expect(within(canvas).getAllByRole("button",{name:/등록된 영상 .* 선택/})).toHaveLength(3);
    expect(within(canvas).getByText(/실데이터 분석이나 연결 관계의 증거가 아닙니다/))
      .toBeInTheDocument();
    const a=within(canvas).getByRole("button",{name:/등록된 영상 A0000000000 선택/});
    await user.click(a);
    expect(a).toHaveAttribute("aria-pressed","true");
    expect(within(canvas).getByText(/존재 여부·채널 소속·분석 미확인/))
      .toBeInTheDocument();
    await user.click(within(canvas).getByRole("button",{name:"그래프 확대"}));
    expect(within(canvas).getByLabelText("노드 탐색 캔버스")).toBeInTheDocument();
    await user.click(within(canvas).getByRole("button",{name:"화면 맞춤"}));
    expect(a).toHaveAttribute("aria-pressed","false");
  });

  it("paginates when more than 24 targets are registered instead of dropping them",async()=>{
    const urls=Array.from({length:27},(_,i)=>
      "https://youtu.be/"+"A"+i.toString().padStart(10,"0"));
    const targets=addWorkspaceUrlTargets([],urls.join("\n")).targets;
    render(<WorkspaceUrlCanvas targets={targets}/>);
    expect(screen.getAllByRole("button",{name:/등록된 영상 .* 선택/})).toHaveLength(24);
    await userEvent.setup().click(screen.getByRole("button",{name:"다음"}));
    expect(screen.getAllByRole("button",{name:/등록된 영상 .* 선택/})).toHaveLength(3);
  });
});
