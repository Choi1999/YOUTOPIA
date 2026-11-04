import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe,expect,it,vi} from "vitest";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";
import {WorkspaceUrlTargetBoard} from "./WorkspaceUrlTargetBoard";

describe("UI-R04-B adaptive registered-target panels",()=>{
  it("mounts only when targets exist and grows with number of registered URLs",()=>{
    const onRemove=vi.fn(),onClear=vi.fn();
    const {rerender}=render(<WorkspaceUrlTargetBoard targets={[]} onRemove={onRemove} onClear={onClear}/>);
    expect(screen.queryByRole("region",{name:"URL로 추가한 분석 대상"})).not.toBeInTheDocument();
    const result=addWorkspaceUrlTargets([],[
      "https://youtu.be/Ab0_-123xyz",
      "https://youtu.be/Cb0_-123xyz",
      "https://youtube.com/@SomeCreator",
    ].join("\n"));
    rerender(<WorkspaceUrlTargetBoard targets={result.targets} onRemove={onRemove} onClear={onClear}/>);
    const region=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(region).getAllByRole("article")).toHaveLength(3);
    expect(region.querySelector(".workspace-url-board__grid"))
      .toHaveAttribute("data-density","flex");
    expect(within(region).getAllByText(/메타데이터 미확인/)).toHaveLength(2);
  });

  it("expands only the focused panel, supports explicit removal and does not imply live analysis",async()=>{
    const user=userEvent.setup(),onRemove=vi.fn(),onClear=vi.fn();
    const result=addWorkspaceUrlTargets([],"https://youtu.be/Ab0_-123xyz");
    render(<WorkspaceUrlTargetBoard targets={result.targets} onRemove={onRemove} onClear={onClear}/>);
    const region=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(region.querySelector(".workspace-url-board__grid")).toHaveAttribute("data-density","single");
    await user.click(within(region).getByRole("button",{name:"패널 확장"}));
    expect(within(region).getByText(/제목·썸네일·댓글/)).toBeInTheDocument();
    await user.click(within(region).getByRole("button",{name:"제거"}));
    expect(onRemove).toHaveBeenCalledWith("VIDEO:Ab0_-123xyz");
    await user.click(within(region).getByRole("button",{name:"URL 등록 목록 비우기"}));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("caps initially visible panels without dropping registration state",async()=>{
    const user=userEvent.setup(), onRemove=vi.fn(),onClear=vi.fn();
    const ids=Array.from({length:14},(_,i)=>
      "https://youtu.be/"+"A"+i.toString().padStart(10,"0"));
    const result=addWorkspaceUrlTargets([],ids.join("\n"));
    render(<WorkspaceUrlTargetBoard targets={result.targets} onRemove={onRemove} onClear={onClear}/>);
    const region=screen.getByRole("region",{name:"URL로 추가한 분석 대상"});
    expect(within(region).getAllByRole("article")).toHaveLength(12);
    await user.click(within(region).getByRole("button",{name:/다음 2개 패널 표시/}));
    expect(within(region).getAllByRole("article")).toHaveLength(14);
  });
});
