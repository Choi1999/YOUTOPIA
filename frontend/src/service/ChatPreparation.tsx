import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useMatch, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { serviceApi } from "./api";
import { useResource } from "./components";
import { useSession } from "./SessionProvider";
import {questions,useChatHistory} from "./ChatHistory";
const maintenance="현재 점검 중입니다. 잠시 후 다시 이용해 주세요.";
export function ChatPreparation(){
 const gameId=useMatch("/games/:gameId/*")?.params.gameId,location=useLocation(),[params]=useSearchParams(),session=useSession();
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 const history=useChatHistory();
 const transcript=useRef<HTMLDivElement>(null),follow=useRef(true),[unread,setUnread]=useState(false);
 const admin=session.status==="authenticated"&&session.identity?.kind==="ADMIN";
 const status=useResource(String(open)+":"+admin,s=>open&&admin?serviceApi.chatStatus(s):Promise.resolve(null));
 useEffect(()=>{setOpen(false)},[location.pathname]);
 useLayoutEffect(()=>{
  if(!open||!history.ready)return;
  if(follow.current&&transcript.current){transcript.current.scrollTop=transcript.current.scrollHeight;setUnread(false);}
  else setUnread(true);
 },[history.turns,open,history.ready]);
 useEffect(()=>{
  if(!open)return;
  const background=document.getElementById("root"),priorInert=background?.inert;
  if(background)background.inert=true;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);return}
   if(event.key!=="Tab")return;
   const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')??[]),first=nodes[0],last=nodes.at(-1);
   if(!nodes.includes(document.activeElement as HTMLElement)){event.preventDefault();(event.shiftKey?last:first)?.focus()}
   else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  };
  document.addEventListener("keydown",key,true);
  return()=>{document.removeEventListener("keydown",key,true);if(background)background.inert=priorInert??false;document.body.style.overflow=overflow;trigger.current?.focus()};
 },[open]);
 useEffect(()=>{if(open&&panel.current&&!panel.current.contains(document.activeElement))panel.current.querySelector<HTMLButtonElement>("button")?.focus()},[open,history.busy,status.loading]);
 const disabled=!admin||!history.ready||!status.data?.available||history.busy||history.blocked||status.loading;
 return <><button className="chat-preparation-trigger" ref={trigger} aria-label="Youtopia 분석 도우미 열기" aria-expanded={open} aria-haspopup="dialog" onClick={()=>{follow.current=true;setOpen(true)}}>분석 도우미</button>
 {open&&createPortal(<div className="chat-preparation-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="chat-preparation-panel" role="dialog" aria-modal="true" aria-labelledby="analysis-assistant-title" aria-describedby="analysis-assistant-reason" ref={panel}>
 <header><h2 id="analysis-assistant-title">Youtopia 분석 도우미</h2><button aria-label="분석 도우미 닫기" onClick={()=>setOpen(false)}>닫기</button></header>
 <div className="chat-panel-content">
 <p id="analysis-assistant-reason">시연용 AI 안내입니다. 현재는 프로젝트 소개와 지표 설명을 제공하며, 실제 게임 데이터 분석·RAG는 연결되지 않았습니다.</p>
 <p>현재 화면: {gameId?("Steam 앱 "+gameId.replace("steam:","")):"게임을 선택하지 않았습니다."} · {params.get("days")??(location.pathname.endsWith("/steam")?7:30)}일</p>
 <p className="chart-caption">선택한 게임·기간은 LLM에 전송하지 않습니다. 프로젝트 소개와 일반적인 지표 설명을 제공합니다.</p>
 {session.status==="checking"||session.status==="unavailable"?<p role="status">로그인 상태 확인 중에는 대화 기록을 숨깁니다. 기존 기록은 보관합니다.</p>:!admin?<p role="status">현재 시연은 관리자 로그인 상태에서만 이용할 수 있습니다. <Link to="/admin/login">관리자 로그인</Link></p>:<p role="status">{status.loading?"호출 가능 상태 확인 중":status.error?maintenance:status.data?.message??maintenance}</p>}
 <div className="chat-fixed-questions" role="group" aria-label="고정 질문">{questions.map(q=><button key={q.id} disabled={disabled} onClick={()=>{void history.ask(q.id)}}>{q.text}</button>)}</div>
 <div className="chat-transcript" ref={transcript} role="region" aria-label="분석 도우미 대화 기록" tabIndex={0} onScroll={()=>{const node=transcript.current;if(node){follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<48;if(follow.current)setUnread(false);}}}>
 {history.turns.length===0&&<p className="chart-caption">고정 질문을 선택하면 대화가 여기에 쌓입니다.</p>}
 <ol>{history.turns.map(turn=><li key={turn.requestId}>
 <p className="chat-question"><strong>질문</strong> · {questions.find(q=>q.id===turn.questionId)?.text}</p>
 {turn.state==="pending"&&<p role="status">응답을 기다리고 있습니다.</p>}
 {turn.state==="complete"&&<div className="chat-answer" role="status" aria-label="LLM 일반 설명 응답">{turn.text}</div>}
 {turn.message&&<p role="alert">{turn.message}</p>}
 </li>)}</ol>
 </div>
 {unread&&<button className="chat-latest" onClick={()=>{follow.current=true;if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;setUnread(false);}}>최신 답변으로</button>}
 {history.notice&&<p role="alert">{history.notice}</p>}
 {admin&&!history.busy&&<button disabled={status.loading} onClick={()=>{history.unblock();status.retry()}}>상태 다시 확인</button>}
 <p className="chart-caption">자유 입력·파일 업로드·대화 이력 전송을 제공하지 않습니다. 응답은 참고용 일반 설명입니다.</p>
 </div>
 </section></div>,document.body)}</>;
}
