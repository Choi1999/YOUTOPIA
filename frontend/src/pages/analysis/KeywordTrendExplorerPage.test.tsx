import {render,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe,expect,it,vi} from "vitest";
import {KeywordTrendExplorerPage} from "./KeywordTrendExplorerPage";

const csv=[
  "comment_id,video_id,channel_id,published_at,text,video_title,channel_name",
  "c1,v1,ch1,2026-11-08T08:00:00Z,독일 와인에 관한 이야기,첫 영상,첫 채널",
  "c2,v2,ch2,2026-11-09T08:00:00Z,전혀 다른 주제,둘째 영상,둘째 채널",
].join("\n");

describe("G2-K user-driven keyword entry",()=>{
  it("does not start with provided/trending keywords",()=>{
    render(<KeywordTrendExplorerPage/>);
    expect(screen.getByRole("heading",{name:"키워드 트렌드 탐색"})).toBeInTheDocument();
    expect(screen.getByLabelText("어떤 키워드가 궁금한가요?")).toHaveValue("");
    expect(screen.getByText(/초기 추천 키워드나 가상의 급상승 순위를 표시하지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByLabelText("키워드 관측 결과")).not.toBeInTheDocument();
  });
  it("accepts a free-form phrase but never invents YouTube results",async()=>{
    const user=userEvent.setup();
    render(<KeywordTrendExplorerPage/>);
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"서울 여행");
    await user.click(screen.getByRole("button",{name:"키워드 적용"}));
    expect(screen.getByRole("heading",{name:"“서울 여행” 관측 자료 없음"})).toBeInTheDocument();
  });
  it("renders only real matches from opted-in local CSV, and can clear them",async()=>{
    const user=userEvent.setup();
    render(<KeywordTrendExplorerPage/>);
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"독일 와인");
    await user.click(screen.getByRole("button",{name:"키워드 적용"}));
    await user.upload(screen.getByLabelText("키워드 관측 CSV"),
      new File([csv],"user.csv",{type:"text/csv"}));
    await waitFor(()=>expect(screen.getByText(/관측 댓글 2개를 로컬로 읽었습니다/)).toBeInTheDocument());
    const result=screen.getByLabelText("키워드 관측 결과");
    expect(within(result).getByRole("heading",{name:"“독일 와인” 관측 결과"})).toBeInTheDocument();
    expect(within(result).getByText("독일 와인에 관한 이야기")).toBeInTheDocument();
    expect(within(result).queryByText("전혀 다른 주제")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"자료 비우기"}));
    expect(screen.getByRole("heading",{name:"“독일 와인” 관측 자료 없음"})).toBeInTheDocument();
  });
  it("rejects malformed CSV and keeps the earlier valid selection",async()=>{
    const user=userEvent.setup();
    render(<KeywordTrendExplorerPage/>);
    await user.upload(screen.getByLabelText("키워드 관측 CSV"),
      new File([csv],"user.csv",{type:"text/csv"}));
    await waitFor(()=>expect(screen.getByText(/관측 댓글 2개를 로컬로 읽었습니다/)).toBeInTheDocument());
    await user.upload(screen.getByLabelText("키워드 관측 CSV"),
      new File(["wrong,columns\na,b"],"bad.csv",{type:"text/csv"}));
    await waitFor(()=>expect(screen.getByText(/필수 열.*기존 자료는 유지됩니다/)).toBeInTheDocument());
    expect(screen.getByRole("button",{name:"자료 비우기"})).toBeInTheDocument();
  });
  it("only searches public YouTube video metadata on explicit click",async()=>{
    const user=userEvent.setup();
    const fetchMock=vi.fn(async()=>({
      ok:true,
      json:async()=>({
        kind:"YOUTUBE_PUBLIC_VIDEO_SEARCH_V1",
        source:"YOUTUBE_DATA_API_SEARCH",
        query:"독일 와인",
        fetchedAt:"2026-11-09T06:00:00Z",
        videos:[{
          videoId:"AbCdefghI12",title:"와인 인터뷰",channelId:"channel1",
          channelTitle:"공개 채널",publishedAt:"2026-11-09T00:00:00Z",
          thumbnailUrl:null,videoUrl:"https://www.youtube.com/watch?v=AbCdefghI12",
        }],
      }),
    }));
    vi.stubGlobal("fetch",fetchMock);
    try {
      render(<KeywordTrendExplorerPage/>);
      await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"독일 와인");
      await user.click(screen.getByRole("button",{name:"키워드 적용"}));
      expect(fetchMock).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button",{name:"YouTube 영상 검색"}));
      const live=screen.getByLabelText("실제 YouTube 영상 검색");
      expect(await within(live).findByText("와인 인터뷰")).toBeInTheDocument();
      expect(within(live).getByRole("link",{name:/와인 인터뷰/}))
        .toHaveAttribute("href","https://www.youtube.com/watch?v=AbCdefghI12");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {vi.unstubAllGlobals();}
  });
  it("reports local search server configuration failures clearly",async()=>{
    const user=userEvent.setup();
    const fetchMock=vi.fn(async()=>({
      ok:false,json:async()=>({kind:"ERROR",code:"NOT_CONFIGURED"}),
    }));
    vi.stubGlobal("fetch",fetchMock);
    try {
      render(<KeywordTrendExplorerPage/>);
      await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"서울 축제");
      await user.click(screen.getByRole("button",{name:"키워드 적용"}));
      await user.click(screen.getByRole("button",{name:"YouTube 영상 검색"}));
      expect(await screen.findByRole("alert")).toHaveTextContent("API 키");
    } finally {vi.unstubAllGlobals();}
  });

});
