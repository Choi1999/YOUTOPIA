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
    expect(within(result).getByRole("heading", {name:"입력 문구가 관측된 영상"})).toBeInTheDocument();
    expect(within(result).getByRole("heading", {name:"입력 문구가 관측된 채널"})).toBeInTheDocument();
    // One day has an observed comment but zero keyword matches; draw no false bar.
    const dates = within(result).getByRole("list", {name:"날짜별 관측 분포"});
    expect(dates.querySelectorAll(".keyword-trend__bar")).toHaveLength(1);
    const unmatchedDay = within(dates).getByRole("listitem", {
      name:"2026-11-09: 표본 1건 중 언급 0건",
    });
    expect(unmatchedDay.querySelector(".keyword-trend__bar")).toBeNull();
    expect(screen.getByText(/로컬 CSV 또는 사용자가 선택한 영상에서 가져온 YouTube 최상위 댓글 표본/))
      .toBeInTheDocument();
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


  it("fetches selected video comments only on a separate user click, and shows bounded per-video ratios",async()=>{
    const user=userEvent.setup();
    const video={
      videoId:"AbCdefghI12",title:"독일 와인 리뷰",channelId:"UCabc",
      channelTitle:"시음 채널",publishedAt:"2026-11-08T00:00:00Z",
      thumbnailUrl:null,videoUrl:"https://www.youtube.com/watch?v=AbCdefghI12",
    };
    const comments=[
      {id:"Ugx.1",videoId:video.videoId,videoTitle:video.title,
       channelId:video.channelId,channelName:video.channelTitle,
       publishedAt:"2026-11-09T09:00:00Z",text:"독일 와인 리뷰가 마음에 들어요"},
      {id:"Ugx.2",videoId:video.videoId,videoTitle:video.title,
       channelId:video.channelId,channelName:video.channelTitle,
       publishedAt:"2026-11-08T09:00:00Z",text:"상관없는 이야기"},
    ];
    const mock=vi.fn(async (path:string,_init?:RequestInit)=>({
      ok:true,
      json:async()=>path==="/api/youtube/discover"?{
        kind:"YOUTUBE_PUBLIC_VIDEO_SEARCH_V1",source:"YOUTUBE_DATA_API_SEARCH",
        query:"독일 와인",fetchedAt:"2026-11-09T10:00:00Z",videos:[video],
      }:{
        kind:"YOUTUBE_PUBLIC_TOP_LEVEL_COMMENTS_V1",
        source:"YOUTUBE_DATA_API_COMMENT_THREADS",scope:"FIRST_PAGE_TOP_LEVEL_MAX_100",
        order:"time",query:"독일 와인",videoId:video.videoId,
        videoTitle:video.title,channelId:video.channelId,channelTitle:video.channelTitle,
        fetchedAt:"2026-11-09T10:01:00Z",sampledCount:2,skipped:0,truncated:0,
        hasMore:true,comments,
      },
    }));
    vi.stubGlobal("fetch",mock);
    try{
      render(<KeywordTrendExplorerPage/>);
      await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"독일 와인");
      await user.click(screen.getByRole("button",{name:"키워드 적용"}));
      expect(mock).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button",{name:"YouTube 영상 검색"}));
      expect(await screen.findByText("독일 와인 리뷰")).toBeInTheDocument();
      expect(mock).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole("button",{name:"독일 와인 리뷰 댓글 표본 가져오기"}));
      expect(await screen.findByText("독일 와인 리뷰가 마음에 들어요")).toBeInTheDocument();
      expect(mock).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText("댓글 분석 출처")).toHaveValue("YOUTUBE");
      const comparison=screen.getByLabelText("영상별 키워드 표본 비교");
      expect(within(comparison).getByText(/1\/2개/)).toBeInTheDocument();
      expect(within(comparison).getByText(/50%/)).toBeInTheDocument();
      expect(within(comparison).getByText(/추가 페이지 존재/)).toBeInTheDocument();
      const request=mock.mock.calls[1];
      expect(request[0]).toBe("/api/youtube/comments");
      expect(JSON.stringify(request[1])).toContain(video.videoId);
      await user.click(screen.getByRole("button",{name:"댓글 표본 비우기"}));
      expect(screen.getByRole("heading",{name:"“독일 와인” 관측 자료 없음"})).toBeInTheDocument();
    }finally{vi.unstubAllGlobals();}
  });

  it("does not mix local CSV and API comments or invent results from failed fetches",async()=>{
    const user=userEvent.setup();
    const mock=vi.fn(async (path:string,_init?:RequestInit)=>({
      ok:path==="/api/youtube/discover",
      json:async()=>path==="/api/youtube/discover"?{
        kind:"YOUTUBE_PUBLIC_VIDEO_SEARCH_V1",source:"YOUTUBE_DATA_API_SEARCH",
        query:"독일 와인",fetchedAt:"2026-11-09T10:00:00Z",
        videos:[{videoId:"AbCdefghI12",title:"독일 와인 리뷰",
          channelId:"UCabc",channelTitle:"채널",publishedAt:"2026-11-09T00:00:00Z",
          thumbnailUrl:null,videoUrl:"https://www.youtube.com/watch?v=AbCdefghI12"}],
      }:{kind:"ERROR",code:"YOUTUBE_REQUEST_FAILED"},
    }));
    vi.stubGlobal("fetch",mock);
    try{
      render(<KeywordTrendExplorerPage/>);
      await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"독일 와인");
      await user.click(screen.getByRole("button",{name:"키워드 적용"}));
      await user.upload(screen.getByLabelText("키워드 관측 CSV"),
        new File([csv],"user.csv",{type:"text/csv"}));
      await waitFor(()=>expect(screen.getByText(/관측 댓글 2개를 로컬로 읽었습니다/)).toBeInTheDocument());
      expect(screen.getByLabelText("댓글 분석 출처")).toHaveValue("CSV");
      await user.click(screen.getByRole("button",{name:"YouTube 영상 검색"}));
      await screen.findByText("독일 와인 리뷰");
      await user.click(screen.getByRole("button",{name:"독일 와인 리뷰 댓글 표본 가져오기"}));
      expect(await screen.findByRole("alert")).toHaveTextContent("댓글 조회가 거부");
      expect(screen.getByLabelText("댓글 분석 출처")).toHaveValue("CSV");
      expect(screen.queryByLabelText("영상별 키워드 표본 비교")).not.toBeInTheDocument();
      expect(screen.getByText("독일 와인에 관한 이야기")).toBeInTheDocument();
    }finally{vi.unstubAllGlobals();}
  });


  it("does not render purple bars for zero direct keyword matches even when comments were observed",async()=>{
    const user=userEvent.setup();
    render(<KeywordTrendExplorerPage/>);
    await user.type(screen.getByLabelText("어떤 키워드가 궁금한가요?"),"관련 없는 검색 문구");
    await user.click(screen.getByRole("button",{name:"키워드 적용"}));
    await user.upload(screen.getByLabelText("키워드 관측 CSV"),
      new File([csv],"user.csv",{type:"text/csv"}));
    await waitFor(()=>expect(screen.getByText(/관측 댓글 2개를 로컬로 읽었습니다/)).toBeInTheDocument());
    const results=screen.getByLabelText("키워드 관측 결과");
    const dates=within(results).getByRole("list",{name:"날짜별 관측 분포"});
    expect(dates.querySelectorAll(".keyword-trend__bar")).toHaveLength(0);
    expect(within(dates).getByRole("listitem",{
      name:"2026-11-08: 표본 1건 중 언급 0건",
    })).toBeInTheDocument();
    expect(within(results).getAllByText("현재 표본에서 입력 문구와 일치하는 댓글이 없습니다."))
      .toHaveLength(2);
  });


});
