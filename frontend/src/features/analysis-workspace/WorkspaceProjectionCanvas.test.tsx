import {fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,describe,expect,it,vi} from "vitest";
import {WorkspaceFocusMode} from "./WorkspaceFocusMode";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";
import {R05_SYNTHETIC_CSV} from "./workspaceOfflineProjection";

const url="https://www.youtube.com/watch?v=AbCdefghI12";
const targets=addWorkspaceUrlTargets([],url,1000).targets;
const csv=([
 "comment_id,video_id,channel_id,published_at,text,video_title,channel_name",
 "a,AbCdefghI12,UCaaaaaaaaaaaaaaaaaaaaaa,2026-11-07T08:00:00Z,음악 노래 플레이리스트,사용자 입력 영상,사용자 입력 채널",
 "b,AbCdefghI12,UCaaaaaaaaaaaaaaaaaaaaaa,2026-11-09T09:00:00Z,음악 노래,사용자 입력 영상,사용자 입력 채널",
 "c,Qb0_-123xyz,UCbbbbbbbbbbbbbbbbbbbbbb,2026-11-09T10:00:00Z,노래 좋아요,두 번째 입력 영상,두 번째 채널",
]).join("\n");

function show(){
 return render(<WorkspaceFocusMode targets={targets}
   onAddUrls={raw=>addWorkspaceUrlTargets(targets,raw)}
   onRemove={()=>{}} onExit={()=>{}}/>);
}
afterEach(()=>{
 vi.unstubAllGlobals();
 sessionStorage.clear();
 document.body.style.overflow="";
});

describe("UI-R05-B2: offline nodes inside the existing R04 FocusMode",()=>{
 it("starts with unchanged URL graph and opt-in offline source, without external requests",async()=>{
   const fetchMock=vi.fn();
   vi.stubGlobal("fetch",fetchMock);
   const user=userEvent.setup();
   show();
   const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
   expect(within(dialog).getByRole("button",{name:"등록된 영상 AbCdefghI12 선택"}))
     .toBeInTheDocument();
   expect(within(dialog).queryByRole("region",{name:"오프라인 관측 노드 그래프"}))
     .not.toBeInTheDocument();
   await user.click(within(dialog).getByRole("button",{name:"오프라인 관측 그래프"}));
   expect(within(dialog).getByRole("region",{name:"오프라인 그래프 자료 입력"}))
     .toBeInTheDocument();
   expect(within(dialog).getByText(/아직 실제 YouTube 데이터를 조회하지 않았습니다/))
     .toBeInTheDocument();
   expect(within(dialog).queryByRole("button",{name:/관측 노드 선택/}))
     .not.toBeInTheDocument();
   expect(fetchMock).not.toHaveBeenCalled();
 });

 it("opens a labeled synthetic graph, selects a node in the SAME right dock and restores URL graph",async()=>{
   const user=userEvent.setup();
   show();
   const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
   await user.click(within(dialog).getByRole("button",{name:"오프라인 관측 그래프"}));
   await user.click(within(dialog).getByRole("button",{name:"합성 예시 불러오기"}));
   const canvas=within(dialog).getByRole("region",{name:"오프라인 관측 노드 그래프"});
   expect(canvas).toBeInTheDocument();
   expect(within(dialog).getByText(/합성 예시만 불러왔습니다/)).toBeInTheDocument();
   const stage=within(canvas).getByRole("region",{name:"관측 관계 그래프 이동 영역"});
   const keyword=within(stage).getByRole("button",{name:"관측 노드 선택 사용자 키워드 음악"});
   await user.click(keyword);
   const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
   expect(within(detail).getByRole("heading",{name:"음악"})).toBeInTheDocument();
   expect(within(detail).getByText(/명시적으로 불러온 합성 예시/)).toBeInTheDocument();
   expect(within(detail).getByText("SYNTHETIC_FIXTURE")).toBeInTheDocument();
   await user.click(within(stage).getByRole("button",{
     name:"관측 노드 선택 관측 표현 노래",
   }));
   expect(within(detail).getByText("같은 댓글에 단어 동반 출현"))
     .toBeInTheDocument();
   await user.click(within(dialog).getByRole("button",{name:"URL 그래프로 돌아가기"}));
   expect(within(dialog).getByRole("button",{name:"등록된 영상 AbCdefghI12 선택"}))
     .toBeInTheDocument();
   expect(within(dialog).queryByRole("region",{name:"오프라인 관측 노드 그래프"}))
     .not.toBeInTheDocument();
 });

 it("uses only explicitly selected CSV and does not change registered URLs or cause API requests",async()=>{
   const fetchMock=vi.fn();
   vi.stubGlobal("fetch",fetchMock);
   const user=userEvent.setup();
   show();
   const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
   await user.click(within(dialog).getByRole("button",{name:"오프라인 관측 그래프"}));
   await user.upload(within(dialog).getByLabelText("오프라인 관측 CSV 선택"),
      new File([csv],"my-observations.csv",{type:"text/csv"}));
   await waitFor(()=>expect(within(dialog).getByRole("region",{
      name:"오프라인 관측 노드 그래프"})).toBeInTheDocument());
   expect(within(dialog).getByText(/사용자 선택 CSV를 메모리에서 읽었습니다/))
     .toBeInTheDocument();
   const stage=within(dialog).getByRole("region",{name:"관측 관계 그래프 이동 영역"});
   expect(within(stage).getByRole("button",{
     name:"관측 노드 선택 영상 사용자 입력 영상",
   })).toBeInTheDocument();
   expect(within(dialog).getByText(/기간 내 표본 3개 · 원래 문구 2개/))
     .toBeInTheDocument();
   await user.click(within(stage).getByRole("button",{
     name:"관측 노드 선택 댓글 근거 묶음 선택 표본 · 기간 내 2건",
   }));
   const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
   expect(within(detail).getByText("음악 노래 플레이리스트")).toBeInTheDocument();
   expect(within(detail).getByText(/공식 YouTube 인증 정보가 아닙니다/))
     .toBeInTheDocument();
   expect(fetchMock).not.toHaveBeenCalled();
   await user.click(within(dialog).getByRole("button",{name:"관측 표본 비우기"}));
   expect(within(dialog).queryByRole("region",{name:"오프라인 관측 노드 그래프"}))
     .not.toBeInTheDocument();
   await user.click(within(dialog).getByRole("button",{name:"URL 그래프로 돌아가기"}));
   expect(within(dialog).getByRole("button",{name:"등록된 영상 AbCdefghI12 선택"}))
     .toBeInTheDocument();
 });

 it("filters visible nodes, zooms, changes keyword and keeps no ghost relationships",async()=>{
   const user=userEvent.setup();
   show();
   const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
   await user.click(within(dialog).getByRole("button",{name:"오프라인 관측 그래프"}));
   await user.click(within(dialog).getByRole("button",{name:"합성 예시 불러오기"}));
   const canvas=within(dialog).getByRole("region",{name:"오프라인 관측 노드 그래프"});
   const stage=within(canvas).getByRole("region",{name:"관측 관계 그래프 이동 영역"});
   await user.selectOptions(within(canvas).getByRole("combobox",{
     name:"관측 그래프 유형 필터",
   }),"EXPRESSION");
   expect(within(stage).getAllByRole("button",{name:/관측 노드 선택/}).length)
     .toBeGreaterThan(0);
   expect(within(stage).queryByRole("button",{name:/관측 노드 선택 사용자 키워드/}))
     .not.toBeInTheDocument();
   await user.selectOptions(within(canvas).getByRole("combobox",{
     name:"관측 그래프 유형 필터",
   }),"ALL");
   await user.click(within(canvas).getByRole("button",{name:"관측 그래프 확대"}));
   expect(stage.querySelector(".workspace-projection__plane")?.getAttribute("style"))
     .toContain("scale(1.2)");
   await user.click(within(canvas).getByRole("button",{name:"중심 복원"}));
   expect(stage.querySelector(".workspace-projection__plane")?.getAttribute("style"))
     .toContain("scale(1)");
   const keyword=within(dialog).getByRole("textbox",{name:"원래 키워드"});
   await user.clear(keyword);
   await user.type(keyword,"아무 근거 없는 키워드");
   await user.click(within(dialog).getByRole("button",{name:"키워드 분석 적용"}));
   expect(within(stage).queryByRole("button",{name:/관측 노드 선택 관측 표현/}))
     .not.toBeInTheDocument();
   expect(within(dialog).getByText(/원래 문구 0개/)).toBeInTheDocument();
 });
});
