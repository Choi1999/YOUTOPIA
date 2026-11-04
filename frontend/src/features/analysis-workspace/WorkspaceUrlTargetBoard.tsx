import {useState} from "react";
import "./workspace-url.css";
import { WorkspaceTargetArtwork } from "./WorkspaceTargetArtwork";
import { WorkspaceChannelIdentity } from "./WorkspaceChannelIdentity";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import type {WorkspaceUrlTarget} from "./workspaceUrlTargets";
import {workspaceUrlTargetKey} from "./workspaceUrlTargets";

const PAGE_SIZE=12;

type Props=Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  onRemove: (key:string)=>void;
  onClear:()=>void;
  allowVideoImage?: boolean;
  channelProfiles?: ApprovedChannelProfileCache;
}>;

function name(kind: WorkspaceUrlTarget["kind"]) {
  return kind === "VIDEO" ? "영상" :
    kind === "CHANNEL" ? "채널" : "채널 핸들";
}

/**
 * Responsive panel composition:
 * one target expands, two share the area, many form auto-fit panels.
 * Selecting a card enlarges its footprint if there is enough room.
 * The collection is separate from the two synthetic A/B comparison slots.
 */
export function WorkspaceUrlTargetBoard({targets,onRemove,onClear,allowVideoImage = false,channelProfiles}:Props) {
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const [limit,setLimit]=useState(PAGE_SIZE);
  if (targets.length === 0) return null;

  const count=targets.length;
  const cards=[...targets].reverse().slice(0,limit);
  const focused=cards.some(t=>workspaceUrlTargetKey(t)===selectedKey)
    ? selectedKey : null;
  const density=count===1?"single":count===2?"pair":count<=6?"flex":"dense";

  return (
    <section id="workspace-imports" className="analysis-workspace__panel workspace-url-board"
      aria-label="URL로 추가한 분석 대상">
      <div className="analysis-workspace__heading">
        <div>
          <p className="workspace-url-board__eyebrow">DYNAMIC WORKSPACE / URL TARGETS</p>
          <h2>등록 대상 컬렉션 <span className="workspace-url-board__count">{count}</span></h2>
          <p>추가한 영상과 채널을 확인하고 관리할 수 있습니다.</p>
        </div>
        <button type="button" onClick={onClear} className="workspace-url-board__clear">URL 등록 목록 비우기</button>
      </div>
      <div className="workspace-url-board__grid" data-density={density}
        data-count={String(cards.length)}>
        {cards.map(target=>{
          const key=workspaceUrlTargetKey(target);
          const expanded=focused===key;
          const unresolved=target.kind==="CHANNEL_HANDLE";
          return (
            <article className={"workspace-url-board__card" +
                (expanded?" workspace-url-board__card--focused":"")}
              key={key} aria-label={name(target.kind)+" 등록 대상 "+target.id}>
              <div className="workspace-url-board__card-top">
                <span className="workspace-url-board__kind">{name(target.kind)}</span>
                <span className="workspace-url-board__unverified">
                  {unresolved?"채널 ID 해석 대기":"URL 등록 · 메타데이터 미확인"}
                </span>
              </div>
              <div className="workspace-url-board__card-body">
                <span className="workspace-url-board__orb" aria-hidden="true">
                  <WorkspaceTargetArtwork target={target} variant="card"
                    allowVideoImage={allowVideoImage} channelProfiles={channelProfiles}/>
                </span>
                <div>
                  <strong>{target.id}</strong>
                  <p>아직 분석된 정보가 없습니다.</p>
                  <WorkspaceChannelIdentity target={target} profiles={channelProfiles} compact/>
                </div>
              </div>
              <div className="workspace-url-board__card-controls">
                <button type="button" aria-pressed={expanded}
                  onClick={()=>setSelectedKey(expanded?null:key)}>
                  {expanded?"패널 접기":"패널 확장"}
                </button>
                <a href={target.canonicalUrl} target="_blank" rel="noopener noreferrer">
                  YouTube에서 열기
                </a>
                <button type="button" onClick={()=>{
                  if (selectedKey===key) setSelectedKey(null);
                  onRemove(key);
                }}>제거</button>
              </div>
              {expanded && (
                <div className="workspace-url-board__expanded">
                  <p>이 링크는 목록에 추가됐습니다. 영상·채널의 세부 정보와
                    댓글 분석 결과는 아직 제공되지 않습니다.</p>
                  <code>{target.canonicalUrl}</code>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {count>limit && <button type="button" className="workspace-url-board__more"
        onClick={()=>setLimit(x=>x+PAGE_SIZE)}>
        다음 {Math.min(PAGE_SIZE,count-limit)}개 패널 표시
      </button>}
      <p className="workspace-url-board__footnote">
        추가한 URL만으로 영상·채널 사이의 관계나 분석 결과가 확정되지는 않습니다.
      </p>
    </section>
  );
}
