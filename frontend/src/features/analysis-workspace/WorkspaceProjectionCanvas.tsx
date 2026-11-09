import {
  useState, type PointerEvent, type WheelEvent, type KeyboardEvent,
} from "react";
import type {
  R05GraphProjection, R05GraphNode, R05NodeKind,
} from "./workspaceGraphProjection";
import type { R05OfflineProjectionResult } from "./workspaceOfflineProjection";
import "./workspace-projection.css";

type Ready = Extract<R05OfflineProjectionResult, {kind:"READY"}>;
const PER_PAGE=24;
const kindLabel:Record<R05NodeKind,string> = {
  KEYWORD:"사용자 키워드",VIDEO:"영상",CHANNEL:"채널",
  CHANNEL_HANDLE_CANDIDATE:"채널 핸들 미확인",
  EXPRESSION:"관측 표현",EVIDENCE_SET:"댓글 근거 묶음",GROUP:"사용자 그룹",
};
const edgeLabel:Record<R05GraphProjection["edges"][number]["kind"],string> = {
  RETURNED_BY_SEARCH:"검색 결과 후보",
  CHANNEL_PUBLISHES_VIDEO:"명시된 채널·영상 식별 관계",
  VIDEO_HAS_SAMPLE:"해당 영상에서 선택한 댓글 표본",
  LEXICAL_COOCCURRENCE:"같은 댓글에 단어 동반 출현",
  USER_GROUP_MEMBERSHIP:"사용자가 직접 지정한 그룹",
};

type Props = Readonly<{
  projection: R05GraphProjection;
  labels: Readonly<Record<string,string>>;
  selectedKey: string|null;
  onSelect: (key:string)=>void;
}>;
type Position = Readonly<{x:number;y:number}>;
function layout(nodes:readonly R05GraphNode[]):ReadonlyMap<string,Position>{
  const locations=new Map<string,Position>();
  const grouped=new Map<R05NodeKind,R05GraphNode[]>();
  for(const node of nodes){
    const list=grouped.get(node.kind)??[];
    list.push(node);
    grouped.set(node.kind,list);
  }
  const tracks:Readonly<Record<R05NodeKind,Readonly<{
    x:number;y:number;step:number;columns:number;dx:number;
  }>>> = {
    KEYWORD:{x:520,y:260,step:84,columns:2,dx:110},
    VIDEO:{x:280,y:115,step:104,columns:5,dx:95},
    CHANNEL:{x:80,y:110,step:90,columns:4,dx:95},
    CHANNEL_HANDLE_CANDIDATE:{x:80,y:460,step:76,columns:2,dx:110},
    EXPRESSION:{x:745,y:100,step:86,columns:6,dx:95},
    EVIDENCE_SET:{x:530,y:465,step:76,columns:3,dx:125},
    GROUP:{x:320,y:45,step:72,columns:3,dx:105},
  };
  for(const [kind,list] of grouped){
    const t=tracks[kind];
    list.forEach((node,index)=>{
      const column=Math.floor(index/t.columns);
      locations.set(node.key,{
        x:t.x+column*t.dx,
        y:t.y+(index%t.columns)*t.step,
      });
    });
  }
  return locations;
}

export function WorkspaceProjectionCanvas({projection,labels,selectedKey,onSelect}:Props){
  const [filter,setFilter]=useState<"ALL"|R05NodeKind>("ALL");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [miniOpen,setMiniOpen]=useState(true);
  const [drag,setDrag]=useState<null|{
    id:number;clientX:number;clientY:number;x:number;y:number;
  }>(null);
  const filtered=projection.nodes.filter(node=>
    (filter==="ALL"||node.kind===filter) &&
    (!query.trim() ||
      (labels[node.key]??node.label).toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()) ||
      node.key.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const totalPages=Math.max(1,Math.ceil(filtered.length/PER_PAGE));
  const selectedIndex=filtered.findIndex(node=>node.key===selectedKey);
  const safePage=selectedIndex>=0?Math.floor(selectedIndex/PER_PAGE):
    Math.min(page,totalPages-1);
  const shown=filtered.slice(safePage*PER_PAGE,(safePage+1)*PER_PAGE);
  const position=layout(shown);
  const displayed=new Set(shown.map(node=>node.key));
  const edges=projection.edges.filter(edge=>
    displayed.has(edge.source)&&displayed.has(edge.target));
  function wheel(event:WheelEvent<HTMLDivElement>){
    event.preventDefault();
    setZoom(v=>Math.min(2.25,Math.max(.55,
      Number((v+(event.deltaY<0?.12:-.12)).toFixed(2)))));
  }
  function dragStart(event:PointerEvent<HTMLDivElement>){
    if(event.button!==0 || (event.target instanceof Element &&
      event.target.closest("button,input,select")))return;
    setDrag({id:event.pointerId,clientX:event.clientX,clientY:event.clientY,
      x:pan.x,y:pan.y});
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function dragMove(event:PointerEvent<HTMLDivElement>){
    if(!drag||drag.id!==event.pointerId)return;
    setPan({x:drag.x+event.clientX-drag.clientX,
      y:drag.y+event.clientY-drag.clientY});
  }
  function dragEnd(event:PointerEvent<HTMLDivElement>){
    if(drag?.id!==event.pointerId)return;
    setDrag(null);
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keydown(event:KeyboardEvent<HTMLDivElement>){
    if(event.target!==event.currentTarget)return;
    if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
      event.preventDefault();
      setPan(p=>({...p,x:p.x+(event.key==="ArrowLeft"?-24:24)}));
    }
  }
  return <section className="workspace-projection" aria-label="오프라인 관측 노드 그래프">
    <div className="workspace-projection__toolbar">
      <label>노드 유형
        <select aria-label="관측 그래프 유형 필터" value={filter}
          onChange={e=>{setFilter(e.target.value as typeof filter);setPage(0);}}>
          <option value="ALL">전체</option>
          {Object.entries(kindLabel).map(([value,label])=>
            <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>노드 검색
        <input aria-label="관측 그래프 노드 검색" value={query}
          maxLength={80} onChange={e=>{setQuery(e.target.value);setPage(0);}}
          placeholder="표시 제목 또는 키"/>
      </label>
      <button type="button" aria-label="관측 그래프 확대"
        onClick={()=>setZoom(v=>Math.min(2.25,v+.2))}>+</button>
      <button type="button" aria-label="관측 그래프 축소"
        onClick={()=>setZoom(v=>Math.max(.55,v-.2))}>−</button>
      <button type="button" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>
        중심 복원
      </button>
      <button type="button" aria-pressed={miniOpen}
        onClick={()=>setMiniOpen(v=>!v)}>페이지 개요</button>
    </div>
    <div className="workspace-projection__stage" role="region" tabIndex={0}
      aria-label="관측 관계 그래프 이동 영역" onWheel={wheel}
      onPointerDown={dragStart} onPointerMove={dragMove}
      onPointerUp={dragEnd} onPointerCancel={dragEnd} onKeyDown={keydown}>
      <div className="workspace-projection__plane" style={{
        transform:"translate(-50%,-50%) translate("+pan.x+"px,"+pan.y+
          "px) scale("+zoom+")",
      }}>
        <svg viewBox="0 0 1050 700" aria-hidden="true"
          className="workspace-projection__links">
          {edges.map(edge=>{
            const start=position.get(edge.source),end=position.get(edge.target);
            if(!start||!end)return null;
            return <line key={edge.key} x1={start.x} y1={start.y}
              x2={end.x} y2={end.y}
              className={"workspace-projection__link workspace-projection__link--"+
                edge.kind.toLowerCase()}/>;
          })}
        </svg>
        {shown.map(node=>{
          const pos=position.get(node.key);
          if(!pos)return null;
          return <button type="button" key={node.key}
            className={"workspace-projection__node workspace-projection__node--"+
              node.kind.toLowerCase()+
              (node.key===selectedKey?" is-selected":"")}
            aria-pressed={node.key===selectedKey}
            aria-label={"관측 노드 선택 "+kindLabel[node.kind]+" "+(labels[node.key]??node.label)}
            style={{left:pos.x,top:pos.y}}
            onClick={()=>onSelect(node.key)}>
            <span className="workspace-projection__node-type">{kindLabel[node.kind]}</span>
            <strong>{labels[node.key]??node.label}</strong>
            <small>{node.observedCount===null?"수치 미확인":node.observedCount+"건 관측"}</small>
          </button>;
        })}
      </div>
      {shown.length===0&&<p className="workspace-projection__empty" role="status">
        현재 검색·필터에 맞는 관측 노드가 없습니다. 원본 자료는 유지됩니다.
      </p>}
      {miniOpen&&<div className="workspace-projection__minimap" aria-label="관측 노드 페이지 개요">
        <span>{filtered.length}개 중 {shown.length}개 표시</span>
        <button type="button" disabled={safePage===0} aria-label="관측 이전 페이지"
          onClick={()=>setPage(p=>Math.max(0,p-1))}>이전</button>
        <span>{safePage+1} / {totalPages}</span>
        <button type="button" disabled={safePage===totalPages-1}
          aria-label="관측 다음 페이지"
          onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>다음</button>
      </div>}
    </div>
    <p className="workspace-projection__notice">
      선은 명시된 근거 유형만 나타냅니다. 거리·위치·색은 유사도·인기도·감성 지표가 아닙니다.
      표시되지 않는 노드는 삭제되지 않습니다.
    </p>
  </section>;
}

export function WorkspaceProjectionNodeDetail({data,node}:Readonly<{
  data:Ready;node:R05GraphNode|null;
}>){
  if(!node)return <p>노드를 선택하면 현재 출처의 근거와 관계가 표시됩니다.</p>;
  const associated=data.projection.edges.filter(edge=>
    edge.source===node.key||edge.target===node.key);
  const matchedIds=new Set(associated.flatMap(edge=>edge.evidenceCommentIds??[]));
  const videoRelated=new Set<string>();
  if(node.kind==="VIDEO")videoRelated.add(node.key.slice("VIDEO:".length));
  if(node.kind==="EVIDENCE_SET") for(const edge of associated){
    if(edge.kind==="VIDEO_HAS_SAMPLE"&&edge.source.startsWith("VIDEO:"))
      videoRelated.add(edge.source.slice("VIDEO:".length));
  }
  const excerpts=data.observations.filter(x=>{
    const time=Date.parse(x.publishedAt);
    const start=Date.parse(data.startDay+"T00:00:00Z");
    const end=Date.parse(data.endDay+"T00:00:00Z")+86_400_000;
    return time>=start&&time<end&&
      (matchedIds.has(x.id)||videoRelated.has(x.videoId));
  }).slice(0,5);
  const label=data.labels[node.key]??node.label;
  return <div className="workspace-projection-detail" aria-label="관측 노드 근거 상세">
    <h4>{label}</h4>
    <dl>
      <div><dt>노드 유형</dt><dd>{kindLabel[node.kind]}</dd></div>
      <div><dt>상태</dt><dd>{node.status}</dd></div>
      <div><dt>출처</dt><dd>{node.provenance.kind}</dd></div>
      <div><dt>관측 수</dt><dd>{node.observedCount===null?"미확인":node.observedCount+"건"}</dd></div>
      <div><dt>기준 기간</dt><dd>{data.startDay} ~ {data.endDay} UTC</dd></div>
    </dl>
    <p>{data.sourceKind==="USER_CSV_UNVERIFIED"
      ?"사용자 로컬 CSV의 표기와 수치입니다. 공식 YouTube 인증 정보가 아닙니다."
      :"명시적으로 불러온 합성 예시입니다. 실제 YouTube 자료가 아닙니다."}</p>
    <h5>연결 근거</h5>
    {associated.length?<ul>{associated.slice(0,15).map(edge=>
      <li key={edge.key}>
        <strong>{edgeLabel[edge.kind]}</strong>
        <small>{edge.count===null?"정량 지표 없음":edge.count+"건 관측"} · {edge.provenance.kind}</small>
      </li>)}</ul>:<p>근거가 확인된 연결이 없습니다.</p>}
    {excerpts.length>0&&<>
      <h5>현재 표본의 실제 입력 근거 (최대 5개)</h5>
      <ol>{excerpts.map(record=><li key={record.id}>
        <strong>{record.videoTitle}</strong>
        <time>{record.publishedAt}</time>
        <p>{record.text}</p>
      </li>)}</ol>
    </>}
  </div>;
}
