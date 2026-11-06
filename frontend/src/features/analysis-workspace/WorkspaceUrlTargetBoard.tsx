import {useState} from "react";
import "./workspace-url.css";
import { WorkspaceTargetArtwork } from "./WorkspaceTargetArtwork";
import { metadataStateLabel } from "./workspaceMetadataConsumerState";
import { readyProviderMetadata, providerMetadataStatusLabel } from "./workspaceProviderMetadata";
import { WorkspaceChannelIdentity } from "./WorkspaceChannelIdentity";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import type {WorkspaceUrlTarget} from "./workspaceUrlTargets";
import {workspaceUrlTargetKey} from "./workspaceUrlTargets";
import {
  EMPTY_TARGET_PRESENTATION, userFacingTargetName,
  type WorkspaceTargetPresentation,
} from "./workspaceTargetPresentation";

const PAGE_SIZE=12;

type Props=Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  onRemove: (key:string)=>void;
  onClear:()=>void;
  selectedKey?: string|null;
  /** In integrated mode use the graph's single selection/detail, not a card expansion. */
  onSelectTarget?: (key:string)=>void;
  allowVideoImage?: boolean;
  allowChannelImage?: boolean;
  presentation?: WorkspaceTargetPresentation;
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
export function WorkspaceUrlTargetBoard({
  targets,onRemove,onClear,selectedKey: externalKey,onSelectTarget,
  allowVideoImage = false, allowChannelImage = false,
  presentation = EMPTY_TARGET_PRESENTATION, channelProfiles,
}:Props) {
  const [legacySelectedKey,setLegacySelectedKey]=useState<string|null>(null);
  const selectedKey = onSelectTarget ? externalKey ?? null : legacySelectedKey;
  const [limit,setLimit]=useState(PAGE_SIZE);
  if (targets.length === 0) return null;

  const count=targets.length;
  const cards=[...targets].reverse().slice(0,limit);
  const focused=cards.some(t=>workspaceUrlTargetKey(t)===selectedKey)
    ? selectedKey : null;
  const density=count===1?"single":count===2?"pair":count<=6?"flex":"dense";

  return (
    <section id="workspace-imports" className={"analysis-workspace__panel workspace-url-board" +
        (onSelectTarget ? " workspace-url-board--integrated" : "")}
      aria-label="URL로 추가한 분석 대상">
      <div className="analysis-workspace__heading">
        <div>
          {!onSelectTarget && (
            <p className="workspace-url-board__eyebrow">DYNAMIC WORKSPACE / URL TARGETS</p>
          )}
          <h2>{onSelectTarget ? "등록 대상 목록" : "등록 대상 컬렉션"}{" "}
            <span className="workspace-url-board__count">{count}</span></h2>
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
          const provider=readyProviderMetadata(presentation.providerStates?.[key],target);
          return (
            <article className={"workspace-url-board__card" +
                (expanded?" workspace-url-board__card--focused":"")}
              key={key} aria-label={name(target.kind)+" 등록 대상 "+target.id}>
              <div className="workspace-url-board__card-top">
                <span className="workspace-url-board__kind">{name(target.kind)}</span>
                <span className="workspace-url-board__unverified">
                  {presentation.synthetic?.[key]?.source === "LOCAL_SYNTHETIC_ONLY"
                    ? "합성 데이터 · 제공자 미조회"
                    : provider?"백엔드 정보 표시 · 댓글 분석과 별개"
                    : unresolved?"채널 ID 해석 대기":"URL 등록 · 메타데이터 미확인"}
                </span>
                {presentation.providerStates?.[key] && (
                  <span data-provider-status={presentation.providerStates[key].status}>
                    {providerMetadataStatusLabel(presentation.providerStates[key])}
                  </span>
                )}
                {presentation.metadataStates?.[key] && (
                  <span data-metadata-status={presentation.metadataStates[key].status}>
                    {metadataStateLabel(presentation.metadataStates[key])}
                  </span>
                )}
              </div>
              <div className="workspace-url-board__card-body">
                <span className="workspace-url-board__orb" aria-hidden="true">
                  <WorkspaceTargetArtwork target={target} variant="card"
                    allowVideoImage={allowVideoImage} allowChannelImage={allowChannelImage}
                    presentation={presentation} channelProfiles={channelProfiles}/>
                </span>
                <div>
                  <strong>{userFacingTargetName(target, presentation, channelProfiles)}</strong>
                  <small className="workspace-url-board__id">식별자: {target.id}</small>
                  <p>아직 분석된 정보가 없습니다.</p>
                  <WorkspaceChannelIdentity target={target} profiles={channelProfiles} compact/>
                </div>
              </div>
              <div className="workspace-url-board__card-controls">
                <button type="button" aria-pressed={expanded}
                  onClick={()=>onSelectTarget
                     ? onSelectTarget(key)
                     : setLegacySelectedKey(expanded?null:key)}>
                  {onSelectTarget ? "그래프에서 보기" : expanded?"패널 접기":"패널 확장"}
                </button>
                <a href={target.canonicalUrl} target="_blank" rel="noopener noreferrer">
                  YouTube에서 열기
                </a>
                <button type="button" onClick={()=>{
                  if (!onSelectTarget && selectedKey===key) setLegacySelectedKey(null);
                  onRemove(key);
                }}>제거</button>
              </div>
              {expanded && !onSelectTarget && (
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
