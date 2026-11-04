import { useState, type PointerEvent } from "react";
import "./workspace-url.css";
import { WorkspaceTargetArtwork } from "./WorkspaceTargetArtwork";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import {
  workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";

const PER_VIEW = 24;

type Props = Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  /** Optional controlled focus, shared with fullscreen docking panels. */
  focusedKey?: string | null;
  onFocusChange?: (key: string | null) => void;
  allowVideoImage?: boolean;
  channelProfiles?: ApprovedChannelProfileCache;
}>;

function positions(index:number, total:number) {
  if(total===1) return {x:50,y:50};
  const angle=index*2.399963229728653;
  const radius=9+Math.sqrt((index+.6)/total)*36;
  return {x:50+Math.cos(angle)*radius,y:50+Math.sin(angle)*radius*.83};
}

/**
 * Obsidian-inspired local canvas: click to focus, pointer drag to pan,
 * keyboard zoom and fit. Unverified pasted targets have NO inferred edges.
 * A static, deterministic 2.5D diagram precedes any separately approved
 * WebGL/WebGPU or provider-metadata functionality.
 */
export function WorkspaceUrlCanvas({targets,focusedKey:controlledKey,onFocusChange,allowVideoImage = false,channelProfiles}:Props) {
  const [internalFocusedKey,setInternalFocusedKey]=useState<string|null>(null);
  const focusedKey = controlledKey === undefined ? internalFocusedKey : controlledKey;
  function setFocusedKey(key:string|null) {
    if(controlledKey === undefined) setInternalFocusedKey(key);
    onFocusChange?.(key);
  }
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [dragStart,setDragStart]=useState<{
    clientX:number;clientY:number;x:number;y:number;
  }|null>(null);
  const [page,setPage]=useState(0);

  if(!targets.length) return null;
  const totalPages=Math.ceil(targets.length/PER_VIEW);
  const sorted=[...targets].reverse();
  const focusedIndex=sorted.findIndex(target =>
    workspaceUrlTargetKey(target) === focusedKey);
  // Selecting a target from the dock navigates to its canvas page without
  // changing registration order or losing the current viewport controls.
  const safePage=controlledKey !== undefined && focusedIndex >= 0
    ? Math.floor(focusedIndex/PER_VIEW)
    : Math.min(page,totalPages-1);
  const visible=sorted.slice(safePage*PER_VIEW,(safePage+1)*PER_VIEW);
  const focused=visible.find(t=>workspaceUrlTargetKey(t)===focusedKey)??null;

  function handlePointerDown(event:PointerEvent<HTMLDivElement>) {
    if(event.target!==event.currentTarget) return;
    setDragStart({clientX:event.clientX,clientY:event.clientY,x:pan.x,y:pan.y});
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function handlePointerMove(event:PointerEvent<HTMLDivElement>) {
    if(!dragStart) return;
    setPan({x:dragStart.x+(event.clientX-dragStart.clientX),
      y:dragStart.y+(event.clientY-dragStart.clientY)});
  }
  function handlePointerUp(event:PointerEvent<HTMLDivElement>) {
    if(dragStart && event.currentTarget.hasPointerCapture(event.pointerId)){
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragStart(null);
  }
  function fit() {
    setZoom(1);setPan({x:0,y:0});setFocusedKey(null);
  }

  return (
    <section className="workspace-url-canvas" aria-label="URL 등록 대상 전체 화면 탐색">
      <div className="workspace-url-canvas__toolbar">
        <span>EXPLORER / {targets.length} UNVERIFIED TARGETS</span>
        <div className="workspace-url-canvas__tools">
          <button type="button" aria-label="그래프 축소"
            onClick={()=>setZoom(x=>Math.max(.6,Math.round((x-.2)*10)/10))}>−</button>
          <button type="button" aria-label="그래프 확대"
            onClick={()=>setZoom(x=>Math.min(2,Math.round((x+.2)*10)/10))}>+</button>
          <button type="button" onClick={fit}>화면 맞춤</button>
        </div>
      </div>
      <div className="workspace-url-canvas__viewport"
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        aria-label="노드 탐색 캔버스">
        <div className="workspace-url-canvas__plane" aria-hidden="true"/>
        <div className="workspace-url-canvas__nodes"
          style={{transform:"translate("+pan.x+"px, "+pan.y+"px) scale("+zoom+")"}}>
          {visible.map((target,i)=>{
            const key=workspaceUrlTargetKey(target);
            const p=positions(i,visible.length);
            const selected=focusedKey===key;
            return (
              <button type="button" key={key}
                className={"workspace-url-canvas__node "+
                  (target.kind==="VIDEO"?"is-video":"is-channel")+
                  (selected?" is-focused":"")}
                aria-pressed={selected}
                aria-label={"등록된 "+(target.kind==="VIDEO"?"영상 ":"채널 ")+target.id+" 선택"}
                style={{left:p.x+"%",top:p.y+"%"}}
                onClick={()=>setFocusedKey(selected?null:key)}
                title={target.id}>
                <span className="workspace-url-canvas__node-bubble" aria-hidden="true">
                  <WorkspaceTargetArtwork target={target} variant="node"
                    allowVideoImage={allowVideoImage} channelProfiles={channelProfiles}/>
                </span>
                <span className="workspace-url-canvas__node-label">{target.id}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="workspace-url-canvas__bottom">
        <p>{focused
          ? focused.id+" · URL만 등록됨 · 존재 여부·채널 소속·분석 미확인"
          : "노드를 선택해 초점을 맞추세요. 빈 공간을 드래그하면 캔버스를 이동합니다."}</p>
        {totalPages>1 && (
          <div className="workspace-url-canvas__pager">
            <button type="button" disabled={safePage===0}
              onClick={()=>{setPage(x=>Math.max(0,x-1));setFocusedKey(null);}}>이전</button>
            <span>{safePage+1} / {totalPages}</span>
            <button type="button" disabled={safePage===totalPages-1}
              onClick={()=>{setPage(x=>Math.min(totalPages-1,x+1));setFocusedKey(null);}}>다음</button>
          </div>
        )}
      </div>
      <p className="workspace-url-canvas__disclaimer">
        Obsidian식 탐색 인터랙션을 참조한 2.5D 시안입니다. URL 등록은 실데이터 분석이나 연결 관계의 증거가 아닙니다.
      </p>
    </section>
  );
}
