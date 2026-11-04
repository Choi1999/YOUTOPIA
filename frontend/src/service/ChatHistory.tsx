import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {ApiError,serviceApi,type Identity} from "./api";
import {useSession} from "./SessionProvider";

export const CHAT_STORAGE_PREFIX="youtopia-chat:v1:";
export const questions=[{id:"CCU_BASICS",text:"Youtopia는 어떤 프로젝트인가요?"},{id:"VIDEO_VOLUME",text:"Steam CCU와 YouTube 영상 게시량을 함께 보는 이유는 무엇인가요?"},{id:"JOINT_SIGNALS",text:"앞으로 분석 모델과 RAG는 어떻게 연결할 예정인가요?"}];
const uncertain="처리 결과 미확인입니다. 이전 요청을 자동 재전송하지 않습니다.";
const maintenance="현재 점검 중입니다. 잠시 후 다시 이용해 주세요.";
export type Turn={requestId:string;questionId:string;state:"pending"|"complete"|"error"|"unknown";text?:string;message?:string};
type History={scope:string|null;turns:Turn[];busy:boolean;blocked:boolean;notice:string};
const empty:History={scope:null,turns:[],busy:false,blocked:false,notice:""};
function binding(identity:Identity|null){
 if(identity?.kind!=="ADMIN")return null;
 const verified=/^[0-9]{1,20}$/.test(identity.authVersion??"")&&/^[0-9]{1,20}$/.test(identity.adminGeneration??"");
 return {scope:verified?`ADMIN:${identity.id}:${identity.authVersion}:${identity.adminGeneration}`:`memory:${identity.id}`,persist:verified};
}
function eraseStored(except?:string){try{const storage=sessionStorage;for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(CHAT_STORAGE_PREFIX)&&key!==except)storage.removeItem(key);}}catch{/* Storage is optional. */}}
export function decodeHistory(raw:string,scope:string):Turn[]{
 if(raw.length>64000)throw new Error("대화 기록 크기 초과");
 const value=JSON.parse(raw);
 if(!value||value.version!==1||value.scope!==scope||Object.keys(value).some(k=>!["version","scope","turns"].includes(k))||!Array.isArray(value.turns)||value.turns.length>12)throw new Error("대화 기록 형식 오류");
 const seen=new Set<string>();
 return value.turns.map((turn:Turn)=>{
  if(!turn||Object.keys(turn).some(k=>!["requestId","questionId","state","text","message"].includes(k))||typeof turn.requestId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(turn.requestId)||seen.has(turn.requestId)||!questions.some(q=>q.id===turn.questionId)||!["pending","complete","error","unknown"].includes(turn.state)||turn.text!==undefined&&(typeof turn.text!=="string"||turn.text.length>12000)||turn.message!==undefined&&(typeof turn.message!=="string"||turn.message.length>400)||turn.state==="complete"&&!turn.text?.trim())throw new Error("대화 항목 형식 오류");
  seen.add(turn.requestId);
  return turn.state==="pending"?{requestId:turn.requestId,questionId:turn.questionId,state:"unknown",message:uncertain}:turn;
 });
}
function restored(scope:string,persist:boolean):Turn[]{
 if(!persist)return [];
 const key=CHAT_STORAGE_PREFIX+scope;
 try{const raw=sessionStorage.getItem(key);return raw?decodeHistory(raw,scope):[];}catch{try{sessionStorage.removeItem(key);}catch{/* Memory fallback. */}return [];}
}
type Value={turns:Turn[];ready:boolean;busy:boolean;blocked:boolean;notice:string;ask:(question:string)=>Promise<void>;unblock:()=>void};
const Context=createContext<Value|null>(null);
export function ChatHistoryProvider({children}:{children:ReactNode}){
 const session=useSession(),[state,setState]=useState<History>(empty);
 const current=useRef(state),epoch=useRef(0),pending=useRef<AbortController|null>(null),candidate=useRef<{scope:string;question:string;id:string}|null>(null);
 const active=session.status==="authenticated"?binding(session.identity):null;
 function publish(next:History){
  next={...next,turns:next.turns.length>12?next.turns.slice(-12):next.turns};
  while(next.turns.length>1&&JSON.stringify({version:1,scope:next.scope,turns:next.turns}).length>64000)next.turns=next.turns.slice(1);
  current.current=next;setState(next);
  if(next.scope&&!next.scope.startsWith("memory:"))try{sessionStorage.setItem(CHAT_STORAGE_PREFIX+next.scope,JSON.stringify({version:1,scope:next.scope,turns:next.turns}));}catch{/* Keep the bounded in-memory history. */}
 }
 function reset(){++epoch.current;pending.current?.abort();pending.current=null;candidate.current=null;eraseStored();publish({...empty,turns:[]});}
 useEffect(()=>{
  if(session.status==="guest"||session.status==="authenticated"&&!active){reset();return;}
  if(!active||current.current.scope===active.scope)return;
  const switching=current.current.scope!==null;
  ++epoch.current;pending.current?.abort();pending.current=null;candidate.current=null;
  const turns=switching?[]:restored(active.scope,active.persist);
  const last=turns.at(-1);if(last?.state==="unknown")candidate.current={scope:active.scope,question:last.questionId,id:last.requestId};
  eraseStored(active.persist?CHAT_STORAGE_PREFIX+active.scope:undefined);
  publish({scope:active.scope,turns,busy:false,blocked:turns.some(t=>t.state==="unknown"),notice:""});
 },[session.status,active?.scope]);
 useEffect(()=>{
  const changing=()=>reset();window.addEventListener("youtopia-auth-changing",changing);
  return()=>{++epoch.current;pending.current?.abort();window.removeEventListener("youtopia-auth-changing",changing);};
 },[]);
 async function ask(question:string){
  if(!active||current.current.scope!==active.scope||current.current.busy||current.current.blocked||!questions.some(q=>q.id===question))return;
  const owner=active.scope,account=session.identity!.id,version=epoch.current;
  const prior=candidate.current;
  const id=prior?.scope===owner&&prior.question===question?prior.id:crypto.randomUUID();
  candidate.current={scope:owner,question,id};
  const turn:Turn={requestId:id,questionId:question,state:"pending"};
  const turns=current.current.turns.some(t=>t.requestId===id)?current.current.turns.map(t=>t.requestId===id?turn:t):[...current.current.turns,turn];
  const cancel=new AbortController();pending.current=cancel;
  publish({...current.current,turns,busy:true,notice:""});
  const update=(result:Turn,blocked:boolean)=>publish({...current.current,turns:current.current.turns.map(t=>t.requestId===id?result:t),busy:false,blocked});
  try{
   const response=await serviceApi.chatAnswer(question,id,account,cancel.signal);
   if(version!==epoch.current||current.current.scope!==owner)return;
   if(response.requestId!==id||response.questionId!==question||typeof response.text!=="string"||!response.text.trim()||response.text.length>12000||response.basis!=="GENERAL_METRIC_EXPLANATION_NO_GAME_DATA")throw new ApiError(0,"INVALID_RESPONSE");
   update({...turn,state:"complete",text:response.text},false);candidate.current=null;
  }catch(error){
   if(version!==epoch.current||current.current.scope!==owner)return;
   const message=error instanceof ApiError&&error.code==="CSRF_INVALID"?"요청 확인 정보가 만료되었습니다. 상태를 다시 확인해 주세요.":error instanceof ApiError&&error.status===401?"로그인 세션이 만료되었습니다. 다시 로그인해 주세요.":error instanceof ApiError&&error.status===403?"호출 권한이 없습니다. 관리자 로그인 상태를 확인해 주세요.":error instanceof ApiError&&error.status===409?"같은 요청의 처리 상태 또는 로그인 계정이 변경되었습니다. 상태를 다시 확인해 주세요.":error instanceof ApiError&&error.status===429?(error.code==="CHAT_TOTAL_LIMIT"?"전체 시연 누적 호출 한도에 도달했습니다.":"시연 호출 한도에 도달했습니다. 잠시 후 다시 확인해 주세요."):maintenance;
   if(error instanceof ApiError&&(error.status===401||error.code==="ACCOUNT_CONTEXT_CHANGED")){reset();publish({...empty,turns:[],notice:message,blocked:true});return;}
   update({...turn,state:error instanceof ApiError&&error.status===0?"unknown":"error",message:error instanceof ApiError&&error.status===0?message+" "+uncertain:message},true);
  }finally{if(version===epoch.current)pending.current=null;}
 }
 const ready=Boolean(active&&state.scope===active.scope);
 return <Context.Provider value={{turns:ready?state.turns:[],ready,busy:ready&&state.busy,blocked:state.blocked,notice:state.notice,ask,unblock:()=>publish({...current.current,blocked:false,notice:""})}}>{children}</Context.Provider>;
}
export function useChatHistory(){const value=useContext(Context);if(!value)throw new Error("대화 기록 공급자가 필요합니다.");return value;}
