import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useMatch, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { ApiError, serviceApi } from "./api";
import { useResource } from "./components";
import { useSession } from "./SessionProvider";
const questions=[{id:"CCU_BASICS",text:"CCU는 무엇인가요?"},{id:"VIDEO_VOLUME",text:"게임 관련 영상 게시량은 어떻게 해석하나요?"},{id:"JOINT_SIGNALS",text:"CCU와 영상 게시량을 함께 보면 무엇을 알 수 있나요?"}];
const maintenance="현재 점검 중입니다. 잠시 후 다시 이용해 주세요.";
export function ChatPreparation(){
 const gameId=useMatch("/games/:gameId/*")?.params.gameId,location=useLocation(),[params]=useSearchParams(),session=useSession();
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 const context=useResource(gameId??"no-game",s=>gameId?serviceApi.detail(gameId,s):Promise.resolve(null));
 const admin=session.status==="authenticated"&&session.identity?.kind==="ADMIN";
 const status=useResource(String(open)+":"+admin,s=>open&&admin?serviceApi.chatStatus(s):Promise.resolve(null));
 const [result,setResult]=useState<{text?:string;message?:string;busy?:boolean;checking?:boolean;blocked?:boolean}>({});
 const last=useRef<{id:string;question:string;owner:string}|null>(null),pending=useRef<AbortController|null>(null),submitting=useRef(false),epoch=useRef(0);
 useEffect(()=>{setOpen(false)},[location.pathname]);
 useEffect(()=>{epoch.current++;pending.current?.abort();submitting.current=false;setResult({});last.current=null;return()=>{epoch.current++;pending.current?.abort()}},[session.generation,location.pathname]);
 useEffect(()=>{
  if(!open)return;
  const background=document.getElementById("root"),priorInert=background?.inert;
  if(background)background.inert=true;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);return}
   if(event.key!=="Tab")return;
   const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')??[]),first=nodes[0],last=nodes.at(-1);
   if(!nodes.includes(document.activeElement as HTMLElement)){event.preventDefault();(event.shiftKey?last:first)?.focus()}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  };
  document.addEventListener("keydown",key,true);
  return()=>{document.removeEventListener("keydown",key,true);if(background)background.inert=priorInert??false;document.body.style.overflow=overflow;trigger.current?.focus()};
 },[open]);
 useEffect(()=>{if(open&&panel.current&&!panel.current.contains(document.activeElement))panel.current.querySelector<HTMLButtonElement>("button")?.focus()},[open,result.busy,result.checking,status.loading]);
 async function ask(question:string){
  if(!admin||!session.identity||!status.data?.available||submitting.current||result.blocked)return;
  const owner=session.identity.id,version=epoch.current;
  const request=last.current?.question===question&&last.current.owner===owner?last.current:{id:crypto.randomUUID(),question,owner};last.current=request;
  const cancel=new AbortController();pending.current=cancel;submitting.current=true;setResult({busy:true});
  try{
   const response=await serviceApi.chatAnswer(question,request.id,owner,cancel.signal);
   if(version!==epoch.current)return;
   if(response.requestId!==request.id||response.questionId!==question||typeof response.text!=="string"||!response.text.trim()||response.basis!=="GENERAL_METRIC_EXPLANATION_NO_GAME_DATA")throw new ApiError(0,"INVALID_RESPONSE");
   setResult({text:response.text});last.current=null;
  }catch(error){
   if(version!==epoch.current)return;
   const message=error instanceof ApiError&&error.code==="CSRF_INVALID"?"요청 확인 정보가 만료되었습니다. 상태를 다시 확인해 주세요.":error instanceof ApiError&&error.status===401?"로그인 세션이 만료되었습니다. 다시 로그인해 주세요.":error instanceof ApiError&&error.status===403?"호출 권한이 없습니다. 관리자 로그인 상태를 확인해 주세요.":error instanceof ApiError&&error.status===409?"같은 요청의 처리 상태 또는 로그인 계정이 변경되었습니다. 상태를 다시 확인해 주세요.":error instanceof ApiError&&error.status===429?(error.code==="CHAT_TOTAL_LIMIT"?"전체 시연 누적 호출 한도에 도달했습니다.":"시연 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요."):maintenance;
   setResult({message,blocked:true});
  }finally{if(version===epoch.current){submitting.current=false;pending.current=null}}
 }
 useEffect(()=>{if(status.data!==undefined||status.error)setResult(previous=>previous.checking?{}:previous)},[status.data,status.error]);
 const disabled=!admin||!status.data?.available||Boolean(result.busy||result.checking||result.blocked);
 return <><button className="chat-preparation-trigger" ref={trigger} aria-label="Youtopia 분석 도우미 열기" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(true)}>분석 도우미</button>
 {open&&createPortal(<div className="chat-preparation-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="chat-preparation-panel" role="dialog" aria-modal="true" aria-labelledby="analysis-assistant-title" aria-describedby="analysis-assistant-reason" ref={panel}>
 <header><h2 id="analysis-assistant-title">Youtopia 분석 도우미</h2><button aria-label="분석 도우미 닫기" onClick={()=>setOpen(false)}>닫기</button></header>
 <p id="analysis-assistant-reason">LLM 응답 시연입니다. 실제 게임 데이터 조회와 RAG는 아직 연결되지 않았습니다.</p>
 <p>현재 화면: {gameId?(context.data?.game.name??"게임 정보 미확인"):"게임을 선택하지 않았습니다."} · {params.get("days")??(location.pathname.endsWith("/steam")?7:30)}일</p>
 <p className="chart-caption">선택한 게임·기간은 LLM에 전송하지 않습니다. 일반적인 지표 설명만 제공합니다.</p>
 {!admin?<p role="status">현재 시연은 관리자 로그인 상태에서만 이용할 수 있습니다. <Link to="/admin/login">관리자 로그인</Link></p>:<p role="status">{status.loading?"호출 가능 상태 확인 중":status.error?maintenance:status.data?.message??maintenance}</p>}
 <div className="chat-fixed-questions" role="group" aria-label="고정 질문">{questions.map(q=><button key={q.id} disabled={disabled} onClick={()=>{void ask(q.id)}}>{q.text}</button>)}</div>
 {result.busy&&<p role="status">응답을 기다리고 있습니다.</p>}
 {result.message&&<p role="alert">{result.message}</p>}
 {result.text&&<div className="chat-answer" role="status" aria-label="LLM 일반 설명 응답">{result.text}</div>}
 {admin&&!result.busy&&<button disabled={result.checking} onClick={()=>{setResult({checking:true});status.retry()}}>상태 다시 확인</button>}
 <p className="chart-caption">자유 입력·파일 업로드·대화 이력 전송을 제공하지 않습니다. 응답은 참고용 일반 설명입니다.</p>
 </section></div>,document.body)}</>;
}
