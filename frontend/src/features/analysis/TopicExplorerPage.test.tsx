import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe,expect,it } from "vitest";
import { TopicExplorerPage } from "../../pages/analysis/TopicExplorerPage";
import { AnalysisRepositoryProvider } from "./data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "./data/DemoAnalysisRepository";
import type { AnalysisRepository } from "./data/AnalysisRepository";
import { demoChannelSelection, demoChannelBSelection } from "./data/demoChannelSelection";
const A=demoChannelSelection.channelId,B=demoChannelBSelection.channelId;
function show(url="/analysis/youtube/topics",repo:AnalysisRepository=demoAnalysisRepository) {
  return render(
    <AnalysisRepositoryProvider repository={repo}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/analysis/youtube/topics" element={<TopicExplorerPage/>}/>
          <Route path="/analysis/youtube/video/:videoId" element={<p>영상 상세 목적지</p>}/>
        </Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>
  );
}
describe("YU-48 — per-topic selected-video evidence Web UI",()=>{
  it("default registered RECIPE shows explicit channel and selected-video counts",async()=>{
    show();
    expect(await screen.findByRole("heading",{name:"주제 RECIPE · 선정 영상별 언급량"}))
      .toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"채널 A · 63건"})).toBeInTheDocument();
    const contributions=screen.getByRole("list",{name:A+" 주제별 영상 기여도"});
    expect(within(contributions).getByText("Ab0_-123xyz · 38건")).toBeInTheDocument();
    expect(within(contributions).getByText("Qb0_-123xyz · 25건")).toBeInTheDocument();
    expect(screen.getByText(/댓글 원문·주제별 감성·시간 추이/)).toBeInTheDocument();
  });
  it("linked two-channel QUALITY reveals B-only topic and safe zero in verified A",async()=>{
    show("/analysis/youtube/topics?topic=QUALITY&channel="+A+"&channel="+B);
    expect(await screen.findByRole("heading",{name:"주제 QUALITY · 선정 영상별 언급량"}))
      .toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"채널 A · 0건"})).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"채널 B · 43건"})).toBeInTheDocument();
    expect(screen.getByText("채널 B − A 주제 언급 차이: +43건")).toBeInTheDocument();
  });
  it("topic select navigates and updates contribution counts",async()=>{
    const user=userEvent.setup();show();
    await screen.findByRole("heading",{name:"주제 RECIPE · 선정 영상별 언급량"});
    await user.selectOptions(screen.getByLabelText("주제 ID"),"PRICE");
    expect(await screen.findByRole("heading",{name:"주제 PRICE · 선정 영상별 언급량"}))
      .toBeInTheDocument();
    expect(screen.getByRole("heading",{name:"채널 A · 57건"})).toBeInTheDocument();
  });
  it("valid unregistered channel does not borrow a topic from another channel",async()=>{
    show("/analysis/youtube/topics?topic=RECIPE&channel=UC"+"Z".repeat(22));
    expect(await screen.findByText(/제한 사유: INCOMPLETE_OR_UNVERIFIED/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:/주제 RECIPE · 선정 영상별 언급량/}))
      .not.toBeInTheDocument();
  });
  it("malformed query with extra key fails closed, not default fixture",()=>{
    show("/analysis/youtube/topics?topic=RECIPE&channel="+A+"&secret=1");
    expect(screen.getByRole("alert")).toHaveTextContent("주제 1개와 유효한 채널");
    expect(screen.queryByRole("heading",{name:/주제 RECIPE · 선정 영상별 언급량/}))
      .not.toBeInTheDocument();
  });
  it("valid unknown topic produces unavailable, not a false zero",async()=>{
    show("/analysis/youtube/topics?topic=NEVER_SEEN&channel="+A);
    expect(await screen.findByText(/제한 사유: TOPIC_NOT_REGISTERED/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:/선정 영상별 언급량/}))
      .not.toBeInTheDocument();
  });
  it("no data from one constituent video blocks all counts",async()=>{
    const repo:AnalysisRepository={async getSnapshot(target){
      if(target.targetId==="Qb0_-123xyz")return{kind:"NOT_FOUND"};
      return demoAnalysisRepository.getSnapshot(target);
    }};
    show(undefined,repo);
    expect(await screen.findByText(/제한 사유: INCOMPLETE_OR_UNVERIFIED/))
      .toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:/주제 RECIPE · 선정 영상별 언급량/}))
      .not.toBeInTheDocument();
  });
});
