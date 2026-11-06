import {render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,describe,expect,it} from "vitest";
import {AnalysisRepositoryProvider} from "../analysis/data/AnalysisRepositoryContext";
import {demoAnalysisRepository} from "../analysis/data/DemoAnalysisRepository";
import {AnalysisWorkspacePage} from "../../pages/analysis/AnalysisWorkspacePage";
import {WorkspaceUrlCanvas} from "./WorkspaceUrlCanvas";
import {WorkspaceTargetArtwork} from "./WorkspaceTargetArtwork";
import {createWorkspaceNodeGroup} from "./workspaceNodeGroups";
import {addWorkspaceUrlTargets,workspaceUrlTargetKey} from "./workspaceUrlTargets";
import {EMPTY_TARGET_PRESENTATION} from "./workspaceTargetPresentation";

function showPage(){
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes>
          <Route path="/analysis/youtube/workspace" element={<AnalysisWorkspacePage/>}/>
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
function sample(...urls:string[]){
  return addWorkspaceUrlTargets([],urls.join("\n")).targets;
}
afterEach(()=>{sessionStorage.clear();document.body.style.overflow="";});

describe("UI-R04-N — explicit consumer UX corrections",()=>{
  it("opens the focus workspace first, even with no registered URLs",async()=>{
    const user=userEvent.setup();
    showPage();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    expect(within(dialog).getByText("영상 또는 채널을 추가하세요")).toBeInTheDocument();
    const url=within(dialog).getByRole("textbox",{name:"URL 추가 입력"});
    expect(url).toHaveFocus();
    await user.type(url,"https://youtu.be/Ab0_-123xyz");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    const canvas=within(dialog).getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    expect(within(canvas).getByText("영상 제목 미확인")).toBeInTheDocument();
    expect(within(dialog).getByRole("button",{name:"집중 모드 북마크 추가"}))
      .toBeEnabled();
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 북마크 추가"}));
    expect(within(dialog).getByRole("button",{name:"집중 모드 북마크 해제"}))
      .toHaveAttribute("aria-pressed","true");
    const title=within(dialog).getByRole("textbox",{name:"표시 제목 (직접 입력)"});
    await user.type(title,"직접 정한 영상 제목");
    await user.click(within(dialog).getByRole("button",{name:"표시 제목 저장"}));
    expect(within(canvas).getByText("직접 정한 영상 제목")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading",{name:"직접 정한 영상 제목"}))
      .toBeInTheDocument();
    await user.click(within(dialog).getByRole("button",{name:"집중 모드 종료"}));
    expect(screen.queryByRole("dialog",{name:"그래프 집중 탐색"})).not.toBeInTheDocument();
  });
  it("can display a user-supplied channel thumbnail only after separate consent",async()=>{
    const user=userEvent.setup();
    showPage();
    const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
    await user.type(within(dialog).getByRole("textbox",{name:"URL 추가 입력"}),
      "https://www.youtube.com/@somecreator");
    await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
    const image="https://yt3.googleusercontent.com/sample-avatar-image";
    const input=within(dialog).getByRole("textbox",{name:"채널 썸네일 이미지 URL"});
    await user.type(input,image);
    await user.click(within(dialog).getByRole("button",{name:"채널 이미지 적용"}));
    expect(dialog.querySelector('img[src^="https://yt3.googleusercontent.com/"]'))
      .not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button",{name:"채널 이미지 켜기"}));
    expect(dialog.querySelector('img[src="'+image+'"]')).toBeInTheDocument();
    const artwork=dialog.querySelector('[data-channel-profile="POLICY_HOLD"][data-preview="requested"]');
    expect(artwork).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button",{name:"채널 이미지 끄기"}));
    expect(dialog.querySelector('img[src="'+image+'"]')).not.toBeInTheDocument();
  });
  it("renders matching graph nodes only, including grouped targets in target filters",async()=>{
    const user=userEvent.setup();
    const targets=sample(
      "https://youtu.be/A0000000000",
      "https://youtu.be/A0000000001",
      "https://www.youtube.com/@samplecreator",
    );
    const ids=targets.map(workspaceUrlTargetKey);
    const groups=createWorkspaceNodeGroup([],targets,ids.slice(0,2),"영상 그룹","teal");
    render(<WorkspaceUrlCanvas targets={targets} groups={groups} bookmarks={[
      {kind:"group",key:groups[0].id},{kind:"target",key:ids[2]},
    ]}/>);
    const canvas=screen.getByRole("region",{name:"URL 등록 대상 전체 화면 탐색"});
    const filter=within(canvas).getByRole("combobox",{name:"탐색 결과 유형"});
    await user.selectOptions(filter,"video");
    expect(canvas.querySelectorAll(".workspace-url-canvas__node.is-video")).toHaveLength(2);
    expect(canvas.querySelectorAll(".workspace-url-canvas__node.is-channel")).toHaveLength(0);
    expect(canvas.querySelectorAll(".workspace-url-canvas__cluster")).toHaveLength(0);
    await user.selectOptions(filter,"channel");
    expect(canvas.querySelectorAll(".workspace-url-canvas__node.is-video")).toHaveLength(0);
    expect(canvas.querySelectorAll(".workspace-url-canvas__node.is-channel")).toHaveLength(1);
    await user.selectOptions(filter,"group");
    expect(canvas.querySelectorAll(".workspace-url-canvas__cluster")).toHaveLength(1);
    expect(canvas.querySelectorAll(".workspace-url-canvas__node")).toHaveLength(0);
    await user.selectOptions(filter,"bookmarked");
    expect(canvas.querySelectorAll(".workspace-url-canvas__cluster")).toHaveLength(1);
    expect(canvas.querySelectorAll(".workspace-url-canvas__node")).toHaveLength(1);
    await user.selectOptions(filter,"all");
    expect(canvas.querySelectorAll(".workspace-url-canvas__node")).toHaveLength(3);
  });
  it("does not fabricate an image for a channel or load it without opt-in",()=>{
    const targets=sample("https://www.youtube.com/@somecreator");
    const target=targets[0];
    const presentation={
      ...EMPTY_TARGET_PRESENTATION,
      channelImages:{[workspaceUrlTargetKey(target)]:"https://yt3.ggpht.com/channel-image"},
    };
    const view=render(<WorkspaceTargetArtwork target={target} variant="detail"
      presentation={presentation}/>);
    expect(view.container.querySelector("img")).toBeNull();
    view.rerender(<WorkspaceTargetArtwork target={target} variant="detail"
      presentation={presentation} allowChannelImage/>);
    expect(view.container.querySelector("img")).toHaveAttribute("src",
      "https://yt3.ggpht.com/channel-image");
    expect(view.container.querySelector('[data-channel-profile="POLICY_HOLD"]'))
      .toBeInTheDocument();
  });
});
