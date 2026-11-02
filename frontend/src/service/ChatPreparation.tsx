import { useEffect, useRef, useState } from "react";
import { useLocation, useMatch, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { serviceApi } from "./api";
import { useResource } from "./components";
function PreparationMessages(){return <div className="chat-preparation-messages"><p>Steam·YouTube 데이터를 바탕으로 게임 흐름을 질문할 수 있는 분석 도우미를 준비하고 있습니다. 아직 응답을 생성하지 않습니다.</p><ul><li>이 게임의 최근 CCU 흐름을 설명해줘</li><li>게임명 검색으로 관측한 신규 영상 수는 어떻게 변했어?</li><li>Steam과 YouTube 지표를 함께 설명해줘</li></ul><dl><dt>응답 출처</dt><dd>연결 준비 중</dd><dt>관측 기간 · 기준 시각</dt><dd>응답 제공 시 함께 표시 예정</dd></dl></div>}
function PreparationInput(){return <fieldset disabled><label htmlFor="analysis-question">질문</label><input id="analysis-question" placeholder="분석 연결 준비 중"/><button>전송</button></fieldset>}
export function ChatPreparation(){
 const gameId=useMatch("/games/:gameId/*")?.params.gameId,location=useLocation(),[params]=useSearchParams();
 const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
 const context=useResource(gameId??"no-game",s=>gameId?serviceApi.detail(gameId,s):Promise.resolve(null));
 useEffect(()=>{setOpen(false)},[location.pathname]);
 useEffect(()=>{
  if(!open)return;
  const background=document.getElementById("root");const priorInert=background?.inert;
  if(background)background.inert=true;
  const previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
  panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  return()=>{if(background)background.inert=priorInert??false;document.body.style.overflow=previousOverflow;trigger.current?.focus()};
 },[open]);
 return <><button className="chat-preparation-trigger" ref={trigger} aria-label="Youtopia 분석 도우미 열기" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(true)}>분석 도우미</button>
 {open&&createPortal(<div className="chat-preparation-backdrop" onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="chat-preparation-panel" role="dialog" aria-modal="true" aria-labelledby="analysis-assistant-title" aria-describedby="analysis-assistant-reason" ref={panel} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();setOpen(false)}if(e.key==="Tab"){e.preventDefault();panel.current?.querySelector<HTMLButtonElement>("button")?.focus()}}}>
 <header><h2 id="analysis-assistant-title">Youtopia 분석 도우미</h2><button aria-label="분석 도우미 닫기" onClick={()=>setOpen(false)}>닫기</button></header><p>준비 중</p>
 <p>현재 맥락: {gameId?(context.data?.game.name??(context.error?"게임 정보 미확인":"게임 정보 확인 중")):"게임을 선택하지 않았습니다."} · {params.get("days")??(location.pathname.endsWith("/steam")?7:30)}일{params.get("videoDate")?" · 게시일 "+params.get("videoDate"):""}{location.pathname.endsWith("/steam")?" · Steam":location.pathname.endsWith("/youtube")?" · YouTube":""}</p>
 <PreparationMessages/><p id="analysis-assistant-reason">분석 기능 연결 전이므로 질문 입력과 전송을 사용할 수 없습니다.</p><PreparationInput/>
 </section></div>,document.body)}</>;
}
