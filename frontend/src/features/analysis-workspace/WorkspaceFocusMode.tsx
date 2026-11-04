import {
  useEffect, useRef, useState,
  type DragEvent, type FormEvent, type KeyboardEvent,
} from "react";

import { WorkspaceUrlCanvas } from "./WorkspaceUrlCanvas";
import { WorkspaceTargetArtwork } from "./WorkspaceTargetArtwork";
import { WorkspaceChannelIdentity } from "./WorkspaceChannelIdentity";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import {
  workspaceUrlTargetKey,
  type WorkspaceUrlIngestResult, type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import "./workspace-focus.css";

type Props = Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  onAddUrls: (raw: string) => WorkspaceUrlIngestResult;
  onRemove: (key: string) => void;
  onExit: () => void;
  allowVideoImage?: boolean;
  onToggleVideoImage?: () => void;
  channelProfiles?: ApprovedChannelProfileCache;
}>;

function kindLabel(kind: WorkspaceUrlTarget["kind"]) {
  return kind === "VIDEO" ? "영상" :
    kind === "CHANNEL" ? "채널" : "채널 핸들";
}

/**
 * UI-R04-C: Obsidian-inspired full-viewport graph and on-demand docks.
 *
 * This is an opt-in BROWSER VIEWPORT overlay (not the Fullscreen API).
 * Canvas and side panels share the same canonical URL collection; opening
 * docks never adds an edge, a metric or a metadata/provider request.
 */
export function WorkspaceFocusMode({
  targets, onAddUrls, onRemove, onExit,
  allowVideoImage = false, onToggleVideoImage, channelProfiles,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const listToggleRef = useRef<HTMLButtonElement>(null);
  const detailToggleRef = useRef<HTMLButtonElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [message, setMessage] = useState(
    "추가된 URL은 미확인 대상입니다. 등록만으로 영상·채널 분석은 시작되지 않습니다.",
  );
  const [dragging, setDragging] = useState(false);

  const selected = targets.find(item => workspaceUrlTargetKey(item) === selectedKey) ?? null;
  const visible = [...targets].reverse().filter(target =>
    target.id.toLocaleLowerCase("ko-KR").includes(search.trim().toLocaleLowerCase("ko-KR")),
  );

  // Restore page scrolling and the invoking control after leaving focus mode.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    exitRef.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  function inNarrowViewport() {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 720px)").matches;
  }

  function focusTarget(key: string | null) {
    setSelectedKey(key);
    if (key) {
      setDetailOpen(true);
      if (inNarrowViewport()) setListOpen(false);
    } else {
      setDetailOpen(false);
    }
  }

  function toggleList() {
    setListOpen(value => !value);
    if (inNarrowViewport()) setDetailOpen(false);
  }

  function toggleDetail() {
    setDetailOpen(value => !value);
    if (inNarrowViewport()) setListOpen(false);
  }

  function ingest(raw: string) {
    const result = onAddUrls(raw);
    setMessage(
      "신규 " + result.added.length + "개 · 중복 " + result.duplicates +
      "개 · 거부 " + result.rejected + "개" +
      (result.capacityReached ? " · 등록 한도에 도달했습니다." : "") +
      " · 실데이터 미조회",
    );
    if (result.added.length) {
      setInput("");
      focusTarget(workspaceUrlTargetKey(result.added[result.added.length - 1]));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (input.trim()) ingest(input);
    else setMessage("YouTube 영상 또는 채널 주소를 입력하세요.");
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (event.dataTransfer.files.length) {
      setMessage("파일 드롭은 지원하지 않습니다. URL 텍스트만 등록합니다.");
      return;
    }
    const raw = event.dataTransfer.getData("text/uri-list") ||
      event.dataTransfer.getData("text/plain");
    if (raw.trim()) ingest(raw);
    else setMessage("URL 텍스트를 찾지 못했습니다.");
  }

  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      onExit();
      return;
    }
    if (event.key !== "Tab") return;
    // The modal stays keyboard-contained even when docks appear/disappear.
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], " +
        '[tabindex="0"]',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function removeSelected() {
    if (!selected) return;
    const key = workspaceUrlTargetKey(selected);
    focusTarget(null);
    onRemove(key);
  }

  const layout = listOpen && detailOpen ? "both" :
    listOpen ? "list" : detailOpen ? "detail" : "none";

  return (
    <div ref={dialogRef} className={"workspace-focus" +
        (dragging ? " workspace-focus--dragging" : "")}
      role="dialog" aria-modal="true" aria-labelledby="workspace-focus-title"
      onKeyDown={keydown}
      onDragOver={event => {event.preventDefault();event.stopPropagation();setDragging(true);}}
      onDragLeave={event => {
        event.stopPropagation();
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={drop}>
      <header className="workspace-focus__header">
        <div className="workspace-focus__brand">
          <span className="workspace-focus__indicator" aria-hidden="true"/>
          <div>
            <p>YOUTOPIA / IMMERSIVE ANALYTICS</p>
            <h2 id="workspace-focus-title">그래프 집중 탐색</h2>
          </div>
          <span className="workspace-focus__count">{targets.length}개 등록</span>
        </div>
        <form className="workspace-focus__intake" aria-label="집중 모드 URL 추가"
          onSubmit={submit}>
          <label htmlFor="focus-url-input" className="sr-only">URL 추가 입력</label>
          <input id="focus-url-input" type="text" value={input}
            onChange={event => setInput(event.target.value)}
            maxLength={8192} spellCheck={false} autoComplete="off"
            placeholder="YouTube URL 붙여넣기 / 링크 드롭"/>
          <button type="submit">추가하기</button>
        </form>
        <div className="workspace-focus__controls">
          {onToggleVideoImage && (
            <button type="button" aria-pressed={allowVideoImage}
              onClick={onToggleVideoImage}
              title="i.ytimg.com 공개 영상 이미지 요청. 채널 프로필은 조회하지 않음">
              {allowVideoImage ? "영상 이미지 끄기" : "영상 이미지 켜기"}
            </button>
          )}
          <button ref={listToggleRef} type="button"
            aria-pressed={listOpen} aria-controls="workspace-focus-target-dock"
            onClick={toggleList}>대상 목록</button>
          <button ref={detailToggleRef} type="button"
            aria-pressed={detailOpen} aria-controls="workspace-focus-detail-dock"
            onClick={toggleDetail}>선택 상세</button>
          <button ref={exitRef} type="button" className="workspace-focus__exit"
            onClick={onExit}>집중 모드 종료</button>
        </div>
      </header>
      <div className="workspace-focus__message" role="status">{message}</div>
      <div className="workspace-focus__body" data-layout={layout}>
        {listOpen && (
          <aside id="workspace-focus-target-dock"
            className="workspace-focus__dock workspace-focus__dock--list"
            aria-label="도킹 대상 목록">
            <div className="workspace-focus__dock-heading">
              <h3>대상 목록</h3>
              <button type="button" onClick={() => {
                setListOpen(false);
                listToggleRef.current?.focus();
              }} aria-label="대상 목록 닫기">닫기</button>
            </div>
            <label className="workspace-focus__search-label" htmlFor="focus-target-filter">
              ID·핸들 검색
            </label>
            <input id="focus-target-filter" type="search" value={search}
              onChange={event => setSearch(event.target.value)} maxLength={80}
              placeholder="등록 대상 검색"/>
            <p className="workspace-focus__dock-count">표시 {visible.length}개 / 등록 {targets.length}개</p>
            <div className="workspace-focus__items" role="group" aria-label="등록 대상 선택">
              {visible.map(target => {
                const key=workspaceUrlTargetKey(target);
                return (
                  <button type="button" key={key} aria-pressed={selectedKey===key}
                    aria-label={"대상 선택 " + kindLabel(target.kind) + " " + target.id}
                    onClick={() => focusTarget(key)}>
                    <span className="workspace-focus__item-ident">
                      <WorkspaceTargetArtwork target={target} variant="list"
                        allowVideoImage={allowVideoImage} channelProfiles={channelProfiles}/>
                      <strong>{target.id}</strong>
                    </span>
                    <span>{kindLabel(target.kind)} · 미확인</span>
                    <WorkspaceChannelIdentity target={target} profiles={channelProfiles} compact/>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
        <div className="workspace-focus__graph" aria-label="중앙 그래프 탐색 영역">
          <WorkspaceUrlCanvas targets={targets} focusedKey={selectedKey}
            onFocusChange={focusTarget} allowVideoImage={allowVideoImage}
            channelProfiles={channelProfiles}/>
        </div>
        {detailOpen && (
          <aside id="workspace-focus-detail-dock"
            className="workspace-focus__dock workspace-focus__dock--detail"
            aria-label="도킹 선택 상세">
            <div className="workspace-focus__dock-heading">
              <h3>선택 상세</h3>
              <button type="button" onClick={() => {
                setDetailOpen(false);
                detailToggleRef.current?.focus();
              }} aria-label="선택 상세 닫기">닫기</button>
            </div>
            {selected ? (
              <div className="workspace-focus__details">
                <span className="workspace-focus__kind">{kindLabel(selected.kind)}</span>
                <WorkspaceTargetArtwork target={selected} variant="detail"
                  allowVideoImage={allowVideoImage} channelProfiles={channelProfiles}/>
                <h4>{selected.id}</h4>
                <WorkspaceChannelIdentity target={selected} profiles={channelProfiles}/>
                <p>등록 완료 · 분석 대상 미확인</p>
                <dl>
                  <div><dt>메타데이터</dt><dd>조회하지 않음</dd></div>
                  <div><dt>댓글·감성 분석</dt><dd>수집하지 않음</dd></div>
                  <div><dt>채널 소속 관계</dt><dd>확인되지 않음</dd></div>
                  {selected.kind === "CHANNEL_HANDLE" && (
                    <div><dt>채널 ID</dt><dd>핸들 해석 대기</dd></div>
                  )}
                </dl>
                <code>{selected.canonicalUrl}</code>
                <a href={selected.canonicalUrl} target="_blank" rel="noopener noreferrer">
                  YouTube에서 열기
                </a>
                <button type="button" onClick={removeSelected}>이 등록 대상 제거</button>
              </div>
            ) : (
              <p>그래프 노드나 대상 목록을 선택하면 해당 ID의 확인 상태를 보여줍니다.</p>
            )}
          </aside>
        )}
      </div>
      <footer className="workspace-focus__footer">
        <span>STATIC / UNVERIFIED · 실제 YouTube 데이터를 조회하지 않습니다.</span>
        <span>Esc: 종료 · Tab: 이동 · 캔버스: 확대/축소·드래그</span>
      </footer>
      {dragging && (
        <div className="workspace-focus__drop-shade" aria-hidden="true">
          <strong>URL 링크를 놓으면 즉시 등록됩니다</strong>
          <small>파일은 읽지 않습니다 · 분석 상태는 미확인</small>
        </div>
      )}
    </div>
  );
}
