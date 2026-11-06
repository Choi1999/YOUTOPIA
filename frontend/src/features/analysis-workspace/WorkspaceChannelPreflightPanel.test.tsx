import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe,expect,it} from "vitest";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";
import {WorkspaceChannelPreflightPanel} from "./WorkspaceChannelPreflightPanel";

function targets(...urls:string[]) {
  return addWorkspaceUrlTargets([],urls.join("\n"),1_000).targets;
}

describe("UI-R04-G — offline preflight UI",()=>{
  it("stays absent for video-only workspaces",()=>{
    const {container}=render(<WorkspaceChannelPreflightPanel targets={targets(
      "https://youtu.be/Ab0_-123xyz")}/>);
    expect(container.firstChild).toBeNull();
  });

  it("shows estimated calls but no live metadata or request buttons",async()=>{
    const user=userEvent.setup();
    render(<WorkspaceChannelPreflightPanel targets={targets(
      "https://youtube.com/channel/UC"+"A".repeat(22),
      "https://youtube.com/@SampleCreator",
      "https://youtu.be/Ab0_-123xyz",
    )}/>);
    const region=screen.getByRole("region",{name:"공개 채널 메타데이터 사전 검증"});
    expect(within(region).getByText("2단위")).toBeInTheDocument();
    expect(within(region).getByText("0건")).toBeInTheDocument();
    expect(within(region).getByRole("status")).toHaveTextContent("POLICY_HOLD");
    expect(within(region).queryByRole("button",{name:/실제.*조회|API.*실행/}))
      .not.toBeInTheDocument();
    await user.click(within(region).getByRole("button",{name:"오프라인 요청 계획 보기"}));
    const details=within(region).getByRole("list",{name:"사전 검증용 요청 계획"});
    expect(within(details).getAllByRole("listitem")).toHaveLength(2);
    expect(within(details).getByText(/channels.list · forHandle/)).toBeInTheDocument();
    await user.click(within(region).getByRole("button",{name:"요청 계획 접기"}));
    expect(within(region).queryByRole("list",{name:"사전 검증용 요청 계획"}))
      .not.toBeInTheDocument();
  });

  it("warns on an offline budget overflow without enabling a request",()=>{
    const urls=Array.from({length:11},(_,i)=>
      "https://youtube.com/@creator"+String(i).padStart(3,"0"));
    render(<WorkspaceChannelPreflightPanel targets={targets(...urls)}/>);
    const region=screen.getByRole("region",{name:"공개 채널 메타데이터 사전 검증"});
    expect(within(region).getByRole("status")).toHaveTextContent(/예산 초과/);
    expect(within(region).getByText("11단위")).toBeInTheDocument();
    expect(within(region).getByText("0건")).toBeInTheDocument();
  });
});
