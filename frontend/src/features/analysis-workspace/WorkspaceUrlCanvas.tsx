import {
  useRef, useState,
  type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent,
} from "react";
import "./workspace-url.css";
import "./workspace-groups.css";
import { WorkspaceTargetArtwork } from "./WorkspaceTargetArtwork";
import type { ApprovedChannelProfileCache } from "./workspaceChannelProfile";
import {
  workspaceUrlTargetKey,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import {
  NODE_GROUP_COLORS, WORKSPACE_MAX_GROUP_MEMBERS,
  collapseWorkspaceNodeGroup, colorWorkspaceNodeGroup,
  createWorkspaceNodeGroup, dissolveWorkspaceNodeGroup,
  moveWorkspaceNodeGroup, renameWorkspaceNodeGroup,
  type WorkspaceNodeGroup, type WorkspaceNodeGroupColor,
} from "./workspaceNodeGroups";

const PER_VIEW = 24;
type Unit =
  | { kind: "target"; target: WorkspaceUrlTarget; key: string }
  | { kind: "group"; group: WorkspaceNodeGroup; key: string };

type Props = Readonly<{
  targets: readonly WorkspaceUrlTarget[];
  /** Optional controlled focus, shared with fullscreen docking panels. */
  focusedKey?: string | null;
  onFocusChange?: (key: string | null) => void;
  allowVideoImage?: boolean;
  channelProfiles?: ApprovedChannelProfileCache;
  groups?: readonly WorkspaceNodeGroup[];
  onGroupsChange?: (groups: readonly WorkspaceNodeGroup[]) => void;
}>;

function positions(index: number, total: number) {
  if (total === 1) return { x: 50, y: 50 };
  const angle = index * 2.399963229728653;
  const radius = 9 + Math.sqrt((index + .6) / total) * 36;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius * .83 };
}
function childPosition(index: number) {
  const ring = Math.floor(index / 6);
  const count = ring === 0 ? 6 : 6;
  const angle = -Math.PI / 2 + (index % 6) * (2 * Math.PI / count) +
    (ring ? Math.PI / 6 : 0);
  const radius = ring === 0 ? 110 : 184;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}
function graphUnits(
  targets: readonly WorkspaceUrlTarget[], groups: readonly WorkspaceNodeGroup[],
): readonly Unit[] {
  const byMember = new Map<string, WorkspaceNodeGroup>();
  groups.forEach(group => group.memberKeys.forEach(key => byMember.set(key, group)));
  const seen = new Set<string>();
  const units: Unit[] = [];
  [...targets].reverse().forEach(target => {
    const key = workspaceUrlTargetKey(target);
    const group = byMember.get(key);
    if (group) {
      if (!seen.has(group.id)) {
        units.push({ kind: "group", group, key: group.id });
        seen.add(group.id);
      }
    } else {
      units.push({ kind: "target", target, key });
    }
  });
  return units;
}
function kindLabel(target: WorkspaceUrlTarget) {
  return target.kind === "VIDEO" ? "영상" : "채널";
}

/**
 * Local deterministic 2.5D graph. Groups are explicitly user-created
 * workspace arrangements, NOT inferred or verified content relationships.
 * No edges, network requests, profile lookup, sentiment or analysis.
 */
export function WorkspaceUrlCanvas({
  targets, focusedKey: controlledKey, onFocusChange,
  allowVideoImage = false, channelProfiles, groups: givenGroups, onGroupsChange,
}: Props) {
  const [internalFocusedKey, setInternalFocusedKey] = useState<string | null>(null);
  const focusedKey = controlledKey === undefined ? internalFocusedKey : controlledKey;
  function setFocusedKey(key: string | null) {
    if (controlledKey === undefined) setInternalFocusedKey(key);
    onFocusChange?.(key);
  }
  const [localGroups, setLocalGroups] = useState<readonly WorkspaceNodeGroup[]>([]);
  const groups = givenGroups ?? localGroups;
  function updateGroups(next: readonly WorkspaceNodeGroup[]) {
    if (next === groups) return;
    if (onGroupsChange) onGroupsChange(next);
    else setLocalGroups(next);
  }

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{
    clientX: number; clientY: number; x: number; y: number; id: number;
  } | null>(null);
  const [page, setPage] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<WorkspaceNodeGroupColor>("blue");
  const [groupPanel, setGroupPanel] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [jumpGroupId, setJumpGroupId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const groupDrag = useRef<{
    pointerId: number; id: string; startX: number; startY: number;
    offsetX: number; offsetY: number; moved: boolean;
  } | null>(null);
  const skipGroupClick = useRef<string | null>(null);

  const units = graphUnits(targets, groups);
  const groupedKeys = new Set(groups.flatMap(group => group.memberKeys));
  const targetMap = new Map(targets.map(target => [workspaceUrlTargetKey(target), target]));
  const chosen = picked.filter(key => targetMap.has(key) && !groupedKeys.has(key));
  const totalPages = Math.max(1, Math.ceil(units.length / PER_VIEW));
  const focusedUnitIndex = units.findIndex(unit =>
    unit.kind === "target" ? unit.key === focusedKey :
      focusedKey != null && unit.group.memberKeys.includes(focusedKey));
  const jumpedIndex = units.findIndex(unit =>
    unit.kind === "group" && unit.group.id === jumpGroupId);
  // The focus dock continues to locate an item on its page, including
  // a member of a collapsed group. Group search can jump across pages.
  const safePage = controlledKey !== undefined && focusedUnitIndex >= 0
    ? Math.floor(focusedUnitIndex / PER_VIEW)
    : jumpedIndex >= 0 ? Math.floor(jumpedIndex / PER_VIEW)
    : Math.min(page, totalPages - 1);
  const visible = units.slice(safePage * PER_VIEW, (safePage + 1) * PER_VIEW);
  const focused = targetMap.get(focusedKey ?? "") ?? null;
  const matches = groups.filter(group => {
    const q = groupSearch.trim().toLocaleLowerCase("ko-KR");
    return !q || group.name.toLocaleLowerCase("ko-KR").includes(q) ||
      group.memberKeys.some(key => key.toLocaleLowerCase("ko-KR").includes(q));
  });

  if (!targets.length) return null;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    setDragStart({
      clientX: event.clientX, clientY: event.clientY,
      x: pan.x, y: pan.y, id: event.pointerId,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart || dragStart.id !== event.pointerId) return;
    setPan({
      x: dragStart.x + (event.clientX - dragStart.clientX),
      y: dragStart.y + (event.clientY - dragStart.clientY),
    });
  }
  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStart?.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragStart(null);
  }
  function fit() {
    setZoom(1); setPan({ x: 0, y: 0 }); setFocusedKey(null);
    setJumpGroupId(null);
  }
  function changePage(direction: number) {
    setPage(value => Math.max(0, Math.min(totalPages - 1, safePage + direction)));
    setJumpGroupId(null);
    setFocusedKey(null);
  }
  function switchChoice(key: string) {
    setPicked(current => current.includes(key)
      ? current.filter(candidate => candidate !== key)
      : [...current, key].slice(0, WORKSPACE_MAX_GROUP_MEMBERS));
  }
  function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = createWorkspaceNodeGroup(groups, targets, chosen, newName, newColor);
    if (next === groups) return;
    updateGroups(next);
    setPicked([]); setSelectionMode(false); setNewName("");
    setGroupPanel(true);
    setJumpGroupId(next[next.length - 1].id);
    setFocusedKey(null);
  }
  function jumpToGroup(id: string) {
    setJumpGroupId(id);
    setFocusedKey(null);
    const index = units.findIndex(unit => unit.kind === "group" && unit.group.id === id);
    if (index >= 0) setPage(Math.floor(index / PER_VIEW));
  }
  function beginGroupDrag(group: WorkspaceNodeGroup, event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    groupDrag.current = {
      pointerId: event.pointerId, id: group.id, startX: event.clientX,
      startY: event.clientY, offsetX: group.offsetX,
      offsetY: group.offsetY, moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function movingGroup(event: PointerEvent<HTMLButtonElement>) {
    const drag = groupDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) <= 4 && !drag.moved) return;
    drag.moved = true;
    updateGroups(moveWorkspaceNodeGroup(
      groups, drag.id, drag.offsetX + dx / zoom, drag.offsetY + dy / zoom,
    ));
    event.preventDefault();
    event.stopPropagation();
  }
  function endGroupDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = groupDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) skipGroupClick.current = drag.id;
    groupDrag.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    event.stopPropagation();
  }
  function groupKeydown(group: WorkspaceNodeGroup, event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey) return;
    const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!dx && !dy && event.key !== "Home") return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 40 : 20;
    updateGroups(moveWorkspaceNodeGroup(
      groups, group.id,
      event.key === "Home" ? 0 : group.offsetX + dx * step,
      event.key === "Home" ? 0 : group.offsetY + dy * step,
    ));
  }
  function toggleGroup(group: WorkspaceNodeGroup) {
    if (skipGroupClick.current === group.id) {
      skipGroupClick.current = null;
      return;
    }
    if (focusedKey && group.memberKeys.includes(focusedKey)) setFocusedKey(null);
    updateGroups(collapseWorkspaceNodeGroup(groups, group.id, !group.collapsed));
  }
  function renderTarget(
    target: WorkspaceUrlTarget, left: string, top: string, grouped: boolean,
  ) {
    const key = workspaceUrlTargetKey(target);
    const selected = focusedKey === key;
    const pickedForGroup = chosen.includes(key);
    return (
      <button type="button" key={key}
        className={"workspace-url-canvas__node " +
          (target.kind === "VIDEO" ? "is-video" : "is-channel") +
          (selected ? " is-focused" : "") +
          (pickedForGroup ? " is-group-picked" : "")}
        aria-pressed={selectionMode ? pickedForGroup : selected}
        aria-label={selectionMode
          ? (grouped ? "그룹에 포함된 " : "그룹용 ") + kindLabel(target) +
            " " + target.id + " 선택"
          : "등록된 " + kindLabel(target) + " " + target.id + " 선택"}
        disabled={selectionMode && grouped}
        style={{ left, top }}
        onClick={() => {
          if (selectionMode) switchChoice(key);
          else { setJumpGroupId(null); setFocusedKey(selected ? null : key); }
        }}
        title={target.id}>
        <span className="workspace-url-canvas__node-bubble" aria-hidden="true">
          <WorkspaceTargetArtwork target={target} variant="node"
            allowVideoImage={allowVideoImage} channelProfiles={channelProfiles}/>
        </span>
        <span className="workspace-url-canvas__node-label">{target.id}</span>
      </button>
    );
  }

  return (
    <section className="workspace-url-canvas" aria-label="URL 등록 대상 전체 화면 탐색">
      <div className="workspace-url-canvas__toolbar">
        <span>EXPLORER / {targets.length} UNVERIFIED TARGETS</span>
        <div className="workspace-url-canvas__tools">
          <button type="button" aria-label="그래프 축소"
            onClick={() => setZoom(x => Math.max(.6, Math.round((x - .2) * 10) / 10))}>−</button>
          <button type="button" aria-label="그래프 확대"
            onClick={() => setZoom(x => Math.min(2, Math.round((x + .2) * 10) / 10))}>+</button>
          <button type="button" onClick={fit}>화면 맞춤</button>
          <button type="button" aria-pressed={selectionMode}
            onClick={() => { setSelectionMode(value => !value); setPicked([]); }}>
            그룹 선택 모드
          </button>
          <button type="button" aria-expanded={groupPanel}
            onClick={() => setGroupPanel(value => !value)}>
            그룹 {groups.length}개
          </button>
        </div>
      </div>
      {selectionMode && (
        <form className="workspace-url-canvas__group-create" onSubmit={createGroup}>
          <span role="status">선택 {chosen.length}/{WORKSPACE_MAX_GROUP_MEMBERS}개 ·
            그룹에 속하지 않은 노드를 2개 이상 선택하세요.</span>
          <input aria-label="새 그룹 이름" placeholder="그룹 이름" maxLength={40}
            value={newName} onChange={event => setNewName(event.target.value)}/>
          <select aria-label="새 그룹 색상" value={newColor}
            onChange={event => {
              const color = NODE_GROUP_COLORS.find(value => value === event.target.value);
              if (color) setNewColor(color);
            }}>
            {NODE_GROUP_COLORS.map(color => <option key={color} value={color}>{color}</option>)}
          </select>
          <button type="submit" disabled={chosen.length < 2 || !newName.trim()}>
            그룹 만들기
          </button>
        </form>
      )}
      {groupPanel && (
        <div className="workspace-url-canvas__group-manager"
          role="region" aria-label="사용자 그룹 관리">
          <label>
            그룹 검색
            <input aria-label="그룹 검색" type="search" value={groupSearch}
              onChange={event => setGroupSearch(event.target.value)}
              placeholder="그룹 이름 또는 등록 ID" maxLength={80}/>
          </label>
          <span className="workspace-url-canvas__group-count">
            검색 결과 {matches.length}/{groups.length}
          </span>
          <div className="workspace-url-canvas__group-list">
            {matches.length === 0 && <span>일치하는 그룹이 없습니다.</span>}
            {matches.map(group => (
              <div key={group.id}
                className={"workspace-url-canvas__group-row is-" + group.color}>
                {editingId === group.id ? (
                  <form aria-label={"그룹 " + group.name + " 이름 편집"}
                    onSubmit={event => {
                      event.preventDefault();
                      updateGroups(renameWorkspaceNodeGroup(groups, group.id, editingName));
                      setEditingId(null);
                    }}>
                    <input aria-label={"그룹 " + group.name + " 새 이름"} value={editingName}
                      maxLength={40} onChange={event => setEditingName(event.target.value)}/>
                    <button type="submit">저장</button>
                  </form>
                ) : (
                  <strong>{group.name} · {group.memberKeys.length}개</strong>
                )}
                <button type="button" aria-label={"그룹 " + group.name + " 찾기"}
                  onClick={() => jumpToGroup(group.id)}>찾기</button>
                <button type="button"
                  aria-label={"그룹 " + group.name + (group.collapsed ? " 펼치기" : " 접기")}
                  onClick={() => updateGroups(collapseWorkspaceNodeGroup(
                    groups, group.id, !group.collapsed,
                  ))}>{group.collapsed ? "펼치기" : "접기"}</button>
                <button type="button" aria-label={"그룹 " + group.name + " 이름 변경"}
                  onClick={() => {
                    setEditingId(group.id); setEditingName(group.name);
                  }}>이름</button>
                <select aria-label={"그룹 " + group.name + " 색상"}
                  value={group.color} onChange={event => {
                    const color = NODE_GROUP_COLORS.find(value => value === event.target.value);
                    if (color) updateGroups(colorWorkspaceNodeGroup(groups, group.id, color));
                  }}>
                  {NODE_GROUP_COLORS.map(color =>
                    <option key={color} value={color}>{color}</option>)}
                </select>
                <button type="button" aria-label={"그룹 " + group.name + " 위치 초기화"}
                  onClick={() => updateGroups(moveWorkspaceNodeGroup(
                    groups, group.id, 0, 0,
                  ))}>위치 초기화</button>
                <button type="button" aria-label={"그룹 " + group.name + " 해제"}
                  onClick={() => {
                    updateGroups(dissolveWorkspaceNodeGroup(groups, group.id));
                    if (editingId === group.id) setEditingId(null);
                    if (jumpGroupId === group.id) setJumpGroupId(null);
                  }}>그룹 해제</button>
              </div>
            ))}
          </div>
          <p>그룹은 사용자가 화면을 정리한 결과이며, 영상·채널의 실제 연결 관계가 아닙니다.</p>
        </div>
      )}
      <div className="workspace-url-canvas__viewport"
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        aria-label="노드 탐색 캔버스">
        <div className="workspace-url-canvas__plane" aria-hidden="true"/>
        <div className="workspace-url-canvas__nodes"
          style={{ transform: "translate(" + pan.x + "px, " + pan.y +
            "px) scale(" + zoom + ")" }}>
          {visible.map((unit, index) => {
            const point = positions(index, visible.length);
            if (unit.kind === "target") {
              return renderTarget(
                unit.target, point.x + "%", point.y + "%", false,
              );
            }
            const group = unit.group;
            const expanded = !group.collapsed || (focusedKey != null &&
              controlledKey !== undefined && group.memberKeys.includes(focusedKey));
            return (
              <div key={group.id}
                className={"workspace-url-canvas__cluster is-" + group.color}
                data-group={group.id}
                style={{
                  left: point.x + "%", top: point.y + "%",
                  transform: "translate(-50%, -50%) translate(" +
                    group.offsetX + "px, " + group.offsetY + "px)",
                } as CSSProperties}>
                <button type="button" className="workspace-url-canvas__group-hub"
                  aria-expanded={expanded} aria-label={"그룹 " + group.name +
                    (expanded ? " 접기" : " 펼치기")}
                  aria-description="사용자가 만든 그룹. Alt+방향키로 그룹 이동, Alt+Home으로 위치 초기화"
                  onClick={() => toggleGroup(group)}
                  onPointerDown={event => beginGroupDrag(group, event)}
                  onPointerMove={movingGroup} onPointerUp={endGroupDrag}
                  onPointerCancel={endGroupDrag}
                  onKeyDown={event => groupKeydown(group, event)}>
                  <span className="workspace-url-canvas__group-marker" aria-hidden="true">
                    {group.memberKeys.length}
                  </span>
                  <strong>{group.name}</strong>
                  <small>{expanded ? "접기" : "펼치기"} · 사용자 그룹</small>
                </button>
                {expanded && group.memberKeys.map((key, memberIndex) => {
                  const target = targetMap.get(key);
                  if (!target) return null;
                  const offset = childPosition(memberIndex);
                  return renderTarget(target, offset.x + "px", offset.y + "px", true);
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="workspace-url-canvas__bottom">
        <p>{selectionMode
          ? "그룹으로 묶을 노드를 선택하세요. 기존 분석 데이터나 관계는 변경되지 않습니다."
          : focused
          ? focused.id + " · URL만 등록됨 · 존재 여부·채널 소속·분석 미확인"
          : "노드를 선택하거나 그룹을 접어 정리하세요. 빈 공간을 드래그하면 이동합니다."}</p>
        {totalPages > 1 && (
          <div className="workspace-url-canvas__pager">
            <button type="button" disabled={safePage === 0}
              onClick={() => changePage(-1)}>이전</button>
            <span>{safePage + 1} / {totalPages}</span>
            <button type="button" disabled={safePage === totalPages - 1}
              onClick={() => changePage(1)}>다음</button>
          </div>
        )}
      </div>
      <p className="workspace-url-canvas__disclaimer">
        2.5D 탐색 그래프입니다. 사용자 그룹은 개인적인 공간 정리일 뿐,
        실데이터 분석이나 영상·채널 연결 관계의 증거가 아닙니다.
      </p>
    </section>
  );
}
