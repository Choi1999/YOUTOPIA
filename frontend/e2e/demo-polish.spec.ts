import {expect,test,type Page} from "@playwright/test";
const administrator={kind:"ADMIN",id:"11111111-1111-4111-8111-111111111111",emailVerified:false,authVersion:"3",adminGeneration:"7"};
const question="Youtopia는 어떤 프로젝트인가요?";
async function mock(page:Page,authenticated=true){
 const state={identity:authenticated?{...administrator}:null as typeof administrator|null,answers:0,identityReads:0};
 await page.route("**/api/v1/**",async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  const send=(data:unknown,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
  if(path.endsWith("/csrf"))return send({token:"synthetic-csrf",headerName:"X-CSRF-TOKEN"});
  if(path.endsWith("/auth/me")){state.identityReads++;return send(state.identity??{code:"AUTHENTICATION_REQUIRED"},state.identity?path==="/api/v1/auth/me"&&state.identity.kind==="ADMIN"?403:200:401);}
  if(path.endsWith("/auth/login")){state.identity={...administrator};return send(state.identity);}
  if(path.endsWith("/auth/logout")){state.identity=null;return route.fulfill({status:204,body:""});}
  if(path.endsWith("/chat/status"))return send({available:true,state:"READY",message:"프로젝트 소개용 LLM입니다."});
  if(path.endsWith("/chat/answers")){
   expect(request.headers()["x-csrf-token"]).toBe("synthetic-csrf");state.answers++;const body=request.postDataJSON();
   expect(Object.keys(body).sort()).toEqual(["questionId","requestId"]);
   return send({...body,text:`시연 답변 ${state.answers}\n`+"프로젝트에 관한 일반 설명입니다.\n".repeat(80),replayed:false,basis:"GENERAL_METRIC_EXPLANATION_NO_GAME_DATA"});
  }
  if(path==="/api/v1/games")return send({content:[],page:{number:0,size:20,totalElements:0,totalPages:0},asOf:"2026-11-04T00:00:00Z",dataStatus:"EMPTY",freshness:"UNASSESSED"});
  if(path.endsWith("/classifications")||path.endsWith("/steam-tags"))return send({state:"EMPTY",options:[],meaning:""});
  if(path.endsWith("/ranking-periods"))return send({content:[],dataStatus:"EMPTY"});
  return send({code:"SOURCE_UNAVAILABLE"},503);
 });return state;
}
async function open(page:Page){await page.getByRole("button",{name:"Youtopia 분석 도우미 열기"}).click();await expect(page.getByRole("button",{name:question,exact:true})).toBeEnabled();}
test("관리자와 공개 목록을 버튼으로 왕복하며 같은 인증 상태를 사용한다",async({page})=>{
 const state=await mock(page);await page.goto("/admin");await page.getByRole("link",{name:"공개 게임 목록",exact:true}).click();await expect(page.getByRole("heading",{name:"관측 게임 탐색"})).toBeVisible();const reads=state.identityReads;
 await page.getByRole("link",{name:"관리자 화면",exact:true}).click();await expect(page.getByRole("button",{name:"로그아웃",exact:true})).toBeVisible();await page.getByRole("link",{name:"공개 게임 목록",exact:true}).click();await open(page);expect(state.identityReads).toBe(reads);expect(state.answers).toBe(0);
});
test("일반 이메일·관리자 ID 진입을 구분하고 관리자 로그인 기본 경로는 게임 목록이다",async({page})=>{
 const state=await mock(page,false);await page.goto("/login");await expect(page.getByLabel("이메일 주소",{exact:true})).toHaveAttribute("type","email");await page.getByRole("link",{name:"관리자 전용 로그인"}).click();await expect(page.getByLabel("관리자 로그인명")).toHaveAttribute("type","text");
 await page.getByLabel("관리자 로그인명").fill("synthetic-operator");await page.getByLabel("비밀번호",{exact:true}).fill("synthetic password 1234");await page.getByRole("button",{name:"로그인",exact:true}).click();await expect(page).toHaveURL(/\/games$/);await page.getByRole("button",{name:"로그아웃",exact:true}).click();await expect(page.getByRole("link",{name:"로그인",exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"관리자 화면",exact:true})).toHaveCount(0);expect(state.answers).toBe(0);
});
test("답변을 상태 확인·포커스·재열기·공개 이동·새로고침에서 재호출 없이 복원한다",async({page})=>{
 const state=await mock(page);await page.goto("/games");await open(page);await page.getByRole("button",{name:question,exact:true}).click();await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toContainText("시연 답변 1");
 await page.getByRole("button",{name:"상태 다시 확인"}).click();await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toContainText("시연 답변 1");
 await page.getByRole("button",{name:"분석 도우미 닫기"}).click();await page.getByRole("link",{name:"Steam 차트",exact:true}).click();await open(page);await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toContainText("시연 답변 1");await page.reload();await open(page);await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toContainText("시연 답변 1");expect(state.answers).toBe(1);
 state.identity={...administrator,adminGeneration:"8"};await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toHaveCount(0);expect(state.answers).toBe(1);
});
test("모바일 대화의 과거 위치를 유지하고 최신 답변으로 명시 이동한다",async({page})=>{
 const state=await mock(page);await page.goto("/admin");await page.getByRole("link",{name:"공개 게임 목록",exact:true}).click();await open(page);await page.getByRole("button",{name:question,exact:true}).click();await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toContainText("시연 답변 1");const transcript=page.getByRole("region",{name:"분석 도우미 대화 기록"});
 await expect.poll(()=>transcript.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(48);
 await transcript.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event("scroll"));});await page.getByRole("button",{name:question,exact:true}).click();await expect(page.getByRole("status",{name:"LLM 일반 설명 응답"})).toHaveCount(2);expect(await transcript.evaluate(el=>el.scrollTop)).toBeLessThan(5);
 await page.getByRole("button",{name:"최신 답변으로"}).click();await expect.poll(()=>transcript.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(48);await expect(page.getByRole("button",{name:"분석 도우미 닫기"})).toBeInViewport();expect(state.answers).toBe(2);
});
