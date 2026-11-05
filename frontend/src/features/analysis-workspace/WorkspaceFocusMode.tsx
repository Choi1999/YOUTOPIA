import {
  useEffect, useRef, useState,
  type CSSProperties, type DragEvent, type FormEvent, type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { WorkspaceUrlCanvas } from "./WorkspaceUrlCanvas";
import { WorkspaceTargetArtwork } from "./WorkspaceTargetArtwork";
import { WorkspaceChannelIdentity } from "./WorkspaceChannelIdentity";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import type { WorkspaceNodeGroup } from "./workspaceNodeGroups";
import type { GraphVisit } from "./workspaceGraphNavigation";
import { hasGraphBookmark, toggleGraphBookmark } from "./workspaceGraphBookmarks";
import {
  EMPTY_TARGET_PRESENTATION, userFacingTargetName,
  type WorkspaceTargetPresentation,
} from "./workspaceTargetPresentation";
import {
  workspaceUrlTargetKey,
  type WorkspaceUrlIngestResult, type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import {
  FOCUS_DETAIL_MIN, FOCUS_LIST_MIN,
  clampFocusDockLayout, focusDockBounds, readFocusDockLayout,
  resizeFocusDockLayout, writeFocusDockLayout,
  type FocusDockLayout, type FocusDockSide,
} from "./workspaceFocusLayout";
import "./workspace-focus.css";

type Props = Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  onAddUrls: (raw: string) => WorkspaceUrlIngestResult;
  onRemove: (key: string) => void;
  onExit: () => void;
  allowVideoImage?: boolean;
  onToggleVideoImage?: () => void;
  allowChannelImage?: boolean;
  onToggleChannelImage?: () => void;
  syntheticPreviewEnabled?: boolean;
  onToggleSyntheticPreview?: () => void;
  presentation?: WorkspaceTargetPresentation;
  onSetTargetLabel?: (key: string, label: string) => boolean;
  onSetChannelArtwork?: (key: string, imageUrl: string) => boolean;
  channelProfiles?: ApprovedChannelProfileCache;
  groups?: readonly WorkspaceNodeGroup[];
  onGroupsChange?: (groups: readonly WorkspaceNodeGroup[]) => void;
  bookmarks?: readonly GraphVisit[];
  onBookmarksChange?: (bookmarks: readonly GraphVisit[]) => void;
}>;

function focusStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage; }
  catch { return null; }
}

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
  allowChannelImage = false, onToggleChannelImage,
  syntheticPreviewEnabled = false, onToggleSyntheticPreview,
  presentation = EMPTY_TARGET_PRESENTATION, onSetTargetLabel, onSetChannelArtwork,
  groups = [], onGroupsChange, bookmarks = [], onBookmarksChange,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listToggleRef = useRef<HTMLButtonElement>(null);
  const detailToggleRef = useRef<HTMLButtonElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [labelDraft, setLabelDraft] = useState("");
  const [imageDraft, setImageDraft] = useState("");
  const [message, setMessage] = useState(
    "추가된 URL은 미확인 대상입니다. 등록만으로 영상·채널 분석은 시작되지 않습니다.",
  );
  const [dragging, setDragging] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const listDockRef = useRef<HTMLElement>(null);
  const detailDockRef = useRef<HTMLElement>(null);
  const pointerDrag = useRef<{
    id: number; side: FocusDockSide; x: number;
    width: number; layout: FocusDockLayout;
  } | null>(null);
  const [resizingSide, setResizingSide] = useState<FocusDockSide | null>(null);
  const [viewportWidth, setViewportWidth] = useState(
    () => typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [dockWidths, setDockWidths] = useState<FocusDockLayout | null>(
    () => readFocusDockLayout(focusStorage()),
  );
  const [measuredWidths, setMeasuredWidths] = useState<FocusDockLayout>({
    list: 280, detail: 300,
  });
  useEffect(() => {
    function syncViewport() { setViewportWidth(window.innerWidth); }
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);
  useEffect(() => { writeFocusDockLayout(focusStorage(), dockWidths); }, [dockWidths]);
  useEffect(() => {
    function measure() {
      const list = Math.round(listDockRef.current?.getBoundingClientRect().width ?? 0);
      const detail = Math.round(detailDockRef.current?.getBoundingClientRect().width ?? 0);
      setMeasuredWidths(previous => {
        const next = {
          list: list > 0 ? list : previous.list,
          detail: detail > 0 ? detail : previous.detail,
        };
        return next.list === previous.list && next.detail === previous.detail
          ? previous : next;
      });
    }
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    [bodyRef.current, listDockRef.current, detailDockRef.current]
      .forEach(node => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [listOpen, detailOpen]);

  const selected = targets.find(item => workspaceUrlTargetKey(item) === selectedKey) ?? null;
  const selectedVisit: GraphVisit | null = selected
    ? { kind:"target", key:workspaceUrlTargetKey(selected) } : null;
  const selectedIsBookmarked = selectedVisit
    ? hasGraphBookmark(bookmarks, selectedVisit) : false;
  useEffect(() => {
    setLabelDraft(selectedKey ? presentation.labels[selectedKey] ?? "" : "");
    setImageDraft(selectedKey ? presentation.channelImages[selectedKey] ?? "" : "");
  }, [selectedKey]);
  const visible = [...targets].reverse().filter(target => {
    const query = search.trim().toLocaleLowerCase("ko-KR");
    return target.id.toLocaleLowerCase("ko-KR").includes(query) ||
      userFacingTargetName(target, presentation, channelProfiles)
        .toLocaleLowerCase("ko-KR").includes(query);
  });

  // Restore page scrolling and the invoking control after leaving focus mode.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
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
        "button:not([disabled]), input:not([disabled]), " +
        "select:not([disabled]), textarea:not([disabled]), a[href], " +
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

  function toggleFocusBookmark() {
    if (!selectedVisit || !onBookmarksChange) return;
    onBookmarksChange(toggleGraphBookmark(
      bookmarks, selectedVisit, targets, groups,
    ));
  }

  function saveDisplayTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKey || !onSetTargetLabel) return;
    const value = labelDraft.trim();
    if (!onSetTargetLabel(selectedKey, value)) {
      setMessage("표시 제목을 확인하세요. 120자 이하의 텍스트만 사용할 수 있습니다.");
    } else {
      setMessage(value ? "사용자 지정 표시 제목을 저장했습니다." :
        "사용자 지정 제목을 초기화했습니다.");
    }
  }

  function saveChannelImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedKey || !onSetChannelArtwork) return;
    const value = imageDraft.trim();
    if (!onSetChannelArtwork(selectedKey, value)) {
      setMessage("이미지 주소를 확인하세요. YouTube의 허용된 HTTPS 이미지 호스트만 사용할 수 있습니다.");
    } else {
      setMessage(value ? "사용자 지정 채널 이미지 주소를 저장했습니다. 이미지 미리보기를 켜야 불러옵니다." :
        "사용자 지정 채널 이미지 주소를 해제했습니다.");
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
  const fittedWidths = dockWidths
    ? clampFocusDockLayout(dockWidths, viewportWidth, listOpen, detailOpen)
    : null;
  const currentWidths = fittedWidths ?? measuredWidths;
  const listBounds = focusDockBounds("list", viewportWidth, detailOpen, currentWidths.detail);
  const detailBounds = focusDockBounds("detail", viewportWidth, listOpen, currentWidths.list);

  function baselineWidths(): FocusDockLayout {
    const list = Math.round(listDockRef.current?.getBoundingClientRect().width ?? 0);
    const detail = Math.round(detailDockRef.current?.getBoundingClientRect().width ?? 0);
    return fittedWidths ?? {
      list: Math.max(FOCUS_LIST_MIN, list || measuredWidths.list),
      detail: Math.max(FOCUS_DETAIL_MIN, detail || measuredWidths.detail),
    };
  }

  function beginResize(side: FocusDockSide, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || viewportWidth <= 1100) return;
    const widths = baselineWidths();
    pointerDrag.current = {
      id: event.pointerId, side, x: event.clientX,
      width: widths[side], layout: widths,
    };
    setResizingSide(side);
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function moveResize(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerDrag.current;
    if (!drag || drag.id !== event.pointerId) return;
    const delta = (event.clientX - drag.x) * (drag.side === "list" ? 1 : -1);
    setDockWidths(resizeFocusDockLayout(
      drag.layout, drag.side, drag.width + delta,
      viewportWidth, listOpen, detailOpen,
    ));
    event.preventDefault();
    event.stopPropagation();
  }

  function endResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerDrag.current?.id !== event.pointerId) return;
    pointerDrag.current = null;
    setResizingSide(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function keyboardResize(side: FocusDockSide, event: KeyboardEvent<HTMLDivElement>) {
    const isList = side === "list";
    const direction = event.key === "ArrowRight" ? 1 :
      event.key === "ArrowLeft" ? -1 : 0;
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    if (viewportWidth <= 1100) return;
    event.preventDefault();
    event.stopPropagation();
    const base = baselineWidths();
    const bounds = focusDockBounds(side, viewportWidth,
      isList ? detailOpen : listOpen, isList ? base.detail : base.list);
    const desired = event.key === "Home" ? bounds.min :
      event.key === "End" ? bounds.max :
      base[side] + direction * (isList ? 1 : -1) * (event.shiftKey ? 25 : 12);
    setDockWidths(resizeFocusDockLayout(
      base, side, desired, viewportWidth, listOpen, detailOpen,
    ));
  }

  const customStyle = fittedWidths ? ({
    "--focus-list-width": fittedWidths.list + "px",
    "--focus-detail-width": fittedWidths.detail + "px",
  } as CSSProperties) : undefined;

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
          <input ref={inputRef} id="focus-url-input" type="text" value={input}
            onChange={event => setInput(event.target.value)}
            maxLength={8192} spellCheck={false} autoComplete="off"
            placeholder="YouTube URL 붙여넣기 / 링크 드롭"/>
          <button type="submit">추가하기</button>
        </form>
        <div className="workspace-focus__controls">
          {onToggleVideoImage && (
            <button type="button" aria-pressed={allowVideoImage}
              onClick={onToggleVideoImage}
              title="공개 영상 썸네일 CDN 이미지를 불러옵니다">
              {allowVideoImage ? "영상 이미지 끄기" : "영상 이미지 켜기"}
            </button>
          )}
          {onToggleSyntheticPreview && (
            <button type="button" aria-pressed={syntheticPreviewEnabled}
              onClick={onToggleSyntheticPreview}
              title="로컬 합성 제목·채널명·썸네일, 실제 Google/YouTube 조회 없음">
              {syntheticPreviewEnabled ? "합성 정보 끄기" : "합성 정보 미리보기"}
            </button>
          )}
          {onToggleChannelImage && (
            <button type="button" aria-pressed={allowChannelImage}
              onClick={onToggleChannelImage}
              title="승인된 채널 이미지 또는 직접 등록한 YouTube 이미지 주소만 불러옵니다">
              {allowChannelImage ? "채널 이미지 끄기" : "채널 이미지 켜기"}
            </button>
          )}
          <button type="button" disabled={!selectedVisit || !onBookmarksChange}
            onClick={toggleFocusBookmark}
            aria-pressed={selectedIsBookmarked}
            aria-label={selectedIsBookmarked
              ? "집중 모드 북마크 해제" : "집중 모드 북마크 추가"}>
            {selectedIsBookmarked ? "★ 북마크됨" : "☆ 북마크 추가"}
          </button>
          <button ref={listToggleRef} type="button"
            aria-pressed={listOpen} aria-controls="workspace-focus-target-dock"
            onClick={toggleList}>대상 목록</button>
          <button ref={detailToggleRef} type="button"
            aria-pressed={detailOpen} aria-controls="workspace-focus-detail-dock"
            onClick={toggleDetail}>선택 상세</button>
          {dockWidths && (
            <button type="button" onClick={() => setDockWidths(null)}
              aria-label="레이아웃 기본값 복원">배치 초기화</button>
          )}
          <button ref={exitRef} type="button" className="workspace-focus__exit"
            onClick={onExit}>집중 모드 종료</button>
        </div>
      </header>
      <div className="workspace-focus__message" role="status">
        {syntheticPreviewEnabled && (
          <strong>합성 데이터 미리보기 · 실제 영상·채널 제목이나 YouTube 응답이 아닙니다. 분석 데이터 없음. </strong>
        )}
        {message}
      </div>
      <div ref={bodyRef} className="workspace-focus__body" data-layout={layout}
        data-resizing={resizingSide ?? undefined} style={customStyle}>
        {listOpen && (
          <aside ref={listDockRef} id="workspace-focus-target-dock"
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
                        allowVideoImage={allowVideoImage}
                        allowChannelImage={allowChannelImage}
                        presentation={presentation} channelProfiles={channelProfiles}/>
                      <strong>{userFacingTargetName(target, presentation, channelProfiles)}</strong>
                    </span>
                    <span>{kindLabel(target.kind)} · ID {target.id} · 미확인
                      {groups.find(group => group.memberKeys.includes(key))
                        ? " · 사용자 그룹" : ""}
                    </span>
                    <WorkspaceChannelIdentity target={target} profiles={channelProfiles} compact/>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
        {listOpen && (
          <div className="workspace-focus__splitter workspace-focus__splitter--list"
            role="separator" tabIndex={0} aria-orientation="vertical"
            aria-label="대상 목록 너비 조절" aria-controls="workspace-focus-target-dock"
            aria-valuemin={FOCUS_LIST_MIN} aria-valuemax={listBounds.max}
            aria-valuenow={Math.max(FOCUS_LIST_MIN,
              Math.min(listBounds.max, currentWidths.list))}
            aria-valuetext={currentWidths.list + "픽셀"}
            onPointerDown={event => beginResize("list", event)}
            onPointerMove={moveResize} onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={event => keyboardResize("list", event)} />
        )}
        <div className="workspace-focus__graph" aria-label="중앙 그래프 탐색 영역">
          {targets.length ? (
            <WorkspaceUrlCanvas targets={targets} focusedKey={selectedKey}
              onFocusChange={focusTarget} allowVideoImage={allowVideoImage}
              allowChannelImage={allowChannelImage}
              presentation={presentation}
              channelProfiles={channelProfiles} groups={groups}
              onGroupsChange={onGroupsChange} bookmarks={bookmarks}
              onBookmarksChange={onBookmarksChange}/>
          ) : (
            <div className="workspace-focus__empty" role="status">
              <strong>영상 또는 채널을 추가하세요</strong>
              <p>위 URL 입력창에 붙여넣거나 YouTube 링크를 끌어다 놓으면
                탐색 공간에 노드가 나타납니다.</p>
            </div>
          )}
        </div>
        {detailOpen && (
          <div className="workspace-focus__splitter workspace-focus__splitter--detail"
            role="separator" tabIndex={0} aria-orientation="vertical"
            aria-label="선택 상세 너비 조절" aria-controls="workspace-focus-detail-dock"
            aria-valuemin={FOCUS_DETAIL_MIN} aria-valuemax={detailBounds.max}
            aria-valuenow={Math.max(FOCUS_DETAIL_MIN,
              Math.min(detailBounds.max, currentWidths.detail))}
            aria-valuetext={currentWidths.detail + "픽셀"}
            onPointerDown={event => beginResize("detail", event)}
            onPointerMove={moveResize} onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={event => keyboardResize("detail", event)} />
        )}
        {detailOpen && (
          <aside ref={detailDockRef} id="workspace-focus-detail-dock"
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
              <div key={selectedKey ?? "none"} className="workspace-focus__details">
                <span className="workspace-focus__kind">{kindLabel(selected.kind)}</span>
                <WorkspaceTargetArtwork target={selected} variant="detail"
                  allowVideoImage={allowVideoImage}
                  allowChannelImage={allowChannelImage}
                  presentation={presentation} channelProfiles={channelProfiles}/>
                <h4>{userFacingTargetName(selected, presentation, channelProfiles)}</h4>
                <p className="workspace-focus__secondary-id">등록 식별자: {selected.id}</p>
                {presentation.synthetic?.[selectedKey ?? ""]?.channelName && (
                  <p>합성 채널 정보: {presentation.synthetic[selectedKey ?? ""].channelName}</p>
                )}
                {onSetTargetLabel && (
                  <form className="workspace-focus__editor" onSubmit={saveDisplayTitle}>
                    <label htmlFor="focus-display-title">표시 제목 (직접 입력)</label>
                    <input id="focus-display-title" value={labelDraft}
                      maxLength={120}
                      placeholder={selected.kind === "VIDEO"
                        ? "영상 제목 입력" : "채널 표시 이름 입력"}
                      onChange={event => setLabelDraft(event.target.value)}/>
                    <button type="submit">표시 제목 저장</button>
                    <small>이름은 직접 입력한 표시용 텍스트입니다. 공식 제목 검증은 별도입니다.</small>
                  </form>
                )}
                {selected.kind !== "VIDEO" && onSetChannelArtwork && (
                  <form className="workspace-focus__editor" onSubmit={saveChannelImage}>
                    <label htmlFor="focus-channel-image-url">채널 썸네일 이미지 URL</label>
                    <input id="focus-channel-image-url" type="url"
                      maxLength={2048} value={imageDraft}
                      placeholder="https://yt3.googleusercontent.com/..."
                      onChange={event => setImageDraft(event.target.value)}/>
                    <button type="submit">채널 이미지 적용</button>
                    <small>허용된 YouTube 이미지 주소만 적용합니다. 자동 프로필 조회는
                      별도 API 승인 후 지원되며 현재는 직접 입력한 이미지만 표시할 수 있습니다.</small>
                  </form>
                )}
                <WorkspaceChannelIdentity target={selected} profiles={channelProfiles}/>
                <p>URL이 추가됐습니다. 이 대상의 분석 정보는 아직 제공되지 않습니다.</p>
                {selected.kind === "CHANNEL_HANDLE" && (
                  <p>채널 이름과 프로필은 아직 확인되지 않았습니다.</p>
                )}
                <code>{selected.canonicalUrl}</code>
                <a href={selected.canonicalUrl} target="_blank" rel="noopener noreferrer">
                  YouTube에서 열기
                </a>
                <button type="button" onClick={removeSelected}>이 등록 대상 제거</button>
              </div>
            ) : (
              <p>그래프 노드나 대상 목록에서 원하는 영상을 선택하세요.</p>
            )}
          </aside>
        )}
      </div>
      <footer className="workspace-focus__footer">
        <span>추가한 링크만으로 분석은 시작되지 않습니다.</span>
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
