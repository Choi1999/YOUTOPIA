import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import "./workspace-url.css";
import { WorkspaceUrlCanvas } from "./WorkspaceUrlCanvas";
import { WorkspaceFocusMode } from "./WorkspaceFocusMode";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import type { WorkspaceUrlIngestResult, WorkspaceUrlTarget } from "./workspaceUrlTargets";
import {
  readWorkspaceNodeGroups, reconcileWorkspaceNodeGroups, writeWorkspaceNodeGroups,
  type WorkspaceNodeGroup,
} from "./workspaceNodeGroups";

type Props = Readonly<{
  targets?: readonly WorkspaceUrlTarget[];
  onAddUrls?: (input: string) => WorkspaceUrlIngestResult;
  onRemoveTarget?: (key: string) => void;
  allowVideoImage?: boolean;
  onToggleVideoImage?: () => void;
  channelProfiles?: ApprovedChannelProfileCache;
}>;

function groupStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

/**
 * UI-R04B: a hero-sized intake canvas. URL registration is immediate and
 * local-only; no provider metadata, snapshots or real comment requests.
 * Browser link drop is text-only. File drops are deliberately unsupported.
 */
export function WorkspaceHero({targets = [], onAddUrls, onRemoveTarget, allowVideoImage = false, onToggleVideoImage, channelProfiles}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  // Purely user-authored grouping, separate from canonical URL targets.
  const [nodeGroups, setNodeGroups] = useState<readonly WorkspaceNodeGroup[]>(() =>
    readWorkspaceNodeGroups(groupStorage(), targets),
  );
  useEffect(() => {
    const reconciled = reconcileWorkspaceNodeGroups(nodeGroups, targets);
    if (reconciled !== nodeGroups) { setNodeGroups(reconciled); return; }
    writeWorkspaceNodeGroups(groupStorage(), nodeGroups, targets);
  }, [nodeGroups, targets]);
  const [feedback, setFeedback] = useState(
    "영상·채널 URL을 붙여넣거나 링크를 끌어다 놓으세요. 외부 데이터를 조회하지 않습니다.",
  );

  function add(raw:string) {
    if (!onAddUrls) {
      setFeedback("이 화면에서는 URL 등록을 사용할 수 없습니다.");
      return;
    }
    const result=onAddUrls(raw);
    setFeedback(
      "신규 "+result.added.length+"개 등록 · 중복 "+result.duplicates+
      "개 · 처리 불가 "+result.rejected+"개"+
      (result.capacityReached?" · 이 탭의 최대 등록 수에 도달했습니다.":"")+
      ". 등록 상태는 미확인입니다.",
    );
    if(result.added.length>0) setInput("");
  }

  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(input.trim()) add(input);
    else setFeedback("YouTube 영상 또는 채널 URL을 입력하세요.");
  }

  function onDrop(event:DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if(event.dataTransfer.files.length) {
      setFeedback("파일 업로드는 지원하지 않습니다. YouTube 링크 텍스트를 끌어다 놓으세요.");
      return;
    }
    const text=event.dataTransfer.getData("text/uri-list") ||
      event.dataTransfer.getData("text/plain");
    if(text.trim()) add(text);
    else setFeedback("드롭된 내용에서 URL을 찾지 못했습니다. 링크를 텍스트로 복사해 붙여넣으세요.");
  }

  const populated=targets.length>0;
  useEffect(() => {
    if(!populated && focusOpen) setFocusOpen(false);
  }, [populated, focusOpen]);

  return (
    <header
      className={"product-heading workspace-hero" +
        (isPlaying ? " workspace-hero--is-playing" : "") +
        (populated ? " workspace-hero--populated" : "") +
        (isDragging ? " workspace-hero--dragging" : "")}
      onDragOver={event=>{event.preventDefault();setIsDragging(true);}}
      onDragLeave={event=>{
        if(!event.currentTarget.contains(event.relatedTarget as Node|null))
          setIsDragging(false);
      }}
      onDrop={onDrop}>
      <div className="workspace-hero__copy">
        <p className="workspace-hero__eyebrow">
          <span className="workspace-hero__signal" aria-hidden="true" />
          YOUTOPIA / SIGNAL INTELLIGENCE
        </p>
        <h1>통합 분석 워크스페이스</h1>
        <p className="workspace-hero__headline">
          반응을 읽는<br />
          <strong>새로운 시야.</strong>
        </p>
        <p className="workspace-hero__description">
          영상과 채널을 추가하고 한 공간에서 자유롭게 탐색하세요.
          현재 분석 결과는 예시 데이터입니다.
        </p>
        <form className="workspace-hero__intake" onSubmit={submit}
          aria-label="YouTube URL 빠른 등록">
          <label htmlFor="workspace-url-paste">
            URL을 붙여넣으면 탐색 캔버스에 즉시 나타납니다
          </label>
          <div className="workspace-hero__intake-row">
            <input id="workspace-url-paste" type="text" value={input}
              onChange={event=>setInput(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=... 또는 @채널 URL"
              autoComplete="off" autoCapitalize="off" spellCheck={false}
              maxLength={8192}/>
            <button type="submit">URL 추가</button>
          </div>
          <p className="workspace-hero__intake-hint">
            여러 URL을 줄바꿈으로 구분해 등록할 수 있습니다. URL 식별자만 저장하며
            영상 제목·소속·댓글·분석 결과는 확인하지 않습니다.
          </p>
          <p role="status" className="workspace-hero__intake-status">{feedback}</p>
        </form>
        {onToggleVideoImage && (
          <div className="workspace-hero__image-consent">
            <button type="button" aria-pressed={allowVideoImage}
              onClick={onToggleVideoImage}>
              {allowVideoImage ? "영상 이미지 미리보기 끄기" : "영상 이미지 미리보기 켜기"}
            </button>
            <span>켜면 i.ytimg.com에서 공개 영상 이미지를 불러옵니다.
              외부 이미지 요청만 허용하며 댓글·메타데이터 API는 요청하지 않습니다.</span>
          </div>
        )}
        {populated && onAddUrls && onRemoveTarget && (
          <button type="button" className="workspace-hero__focus-launch"
            onClick={() => setFocusOpen(true)}>
            전체 화면 집중 모드
          </button>
        )}
        <nav className="workspace-hero__actions" aria-label="워크스페이스 빠른 이동">
          <a className="workspace-hero__primary" href="#workspace-session">
            분석 구성하기 <span aria-hidden="true">↗</span>
          </a>
          <a className="workspace-hero__secondary" href="#workspace-catalog">분석 대상 탐색</a>
          {populated && (
            <a className="workspace-hero__secondary" href="#workspace-imports">
              추가한 대상 {targets.length}개 보기
            </a>
          )}
        </nav>
        <div className="workspace-hero__meta" aria-label="시연 데이터 범위">
          <span><b>04</b> REGISTERED VIDEOS (FIXTURE)</span>
          <span><b>02</b> SYNTHETIC CHANNELS</span>
          <span><b>{String(targets.length).padStart(2,"0")}</b> PASTED URLS</span>
          <span><b>OFFLINE</b> DEMO ONLY</span>
        </div>
        {!populated && (
          <button type="button" className="workspace-hero__motion-control"
            aria-pressed={isPlaying} onClick={()=>setIsPlaying(value=>!value)}>
            {isPlaying ? "3D 모션 중지" : "3D 모션 재생"}
          </button>
        )}
      </div>

      {!populated ? (
        <div className="workspace-hero__visual" aria-hidden="true">
          <div className="workspace-hero__halo" />
          <div className="workspace-hero__orbit workspace-hero__orbit--outer" />
          <div className="workspace-hero__orbit workspace-hero__orbit--inner" />
          <div className="workspace-hero__ring workspace-hero__ring--a" />
          <div className="workspace-hero__ring workspace-hero__ring--b" />
          <div className="workspace-hero__orb" />
          <span className="workspace-hero__satellite workspace-hero__satellite--one" />
          <span className="workspace-hero__satellite workspace-hero__satellite--two" />
          <span className="workspace-hero__satellite workspace-hero__satellite--three" />
          <span className="workspace-hero__diagram-label workspace-hero__diagram-label--one">
            VIDEO / 04
          </span>
          <span className="workspace-hero__diagram-label workspace-hero__diagram-label--two">
            CHANNEL / 02
          </span>
        </div>
      ) : <WorkspaceUrlCanvas targets={targets} allowVideoImage={allowVideoImage}
        channelProfiles={channelProfiles} groups={nodeGroups}
        onGroupsChange={setNodeGroups}/>} 

      {isDragging && (
        <div className="workspace-hero__drop-overlay" aria-hidden="true">
          <strong>여기에 YouTube 링크 놓기</strong>
          <span>화면에서만 즉시 등록 · 데이터 조회 없음</span>
        </div>
      )}
      {focusOpen && populated && onAddUrls && onRemoveTarget &&
        typeof document !== "undefined" && createPortal(
          <WorkspaceFocusMode targets={targets} onAddUrls={onAddUrls}
            onRemove={onRemoveTarget} onExit={() => setFocusOpen(false)}
            allowVideoImage={allowVideoImage}
            onToggleVideoImage={onToggleVideoImage}
            channelProfiles={channelProfiles} groups={nodeGroups}
            onGroupsChange={setNodeGroups}/>,
          document.body,
        )}
    </header>
  );
}
