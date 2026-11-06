import { useState } from "react";
import {
  MAX_NAMED_WORKSPACES,
  deleteNamedWorkspace, listNamedWorkspaces, renameNamedWorkspace,
  restoreNamedWorkspace, saveNamedWorkspace,
  type NamedWorkspaceInfo,
} from "./workspaceNamedSnapshots";

function tabStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}
function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** A collapsed consumer tool; no automatic server calls or restoration. */
export function WorkspaceNamedSaveControls() {
  const [items, setItems] = useState<readonly NamedWorkspaceInfo[] | null>(
    () => listNamedWorkspaces(browserStorage()),
  );
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  function refresh(preferred = ""): readonly NamedWorkspaceInfo[] | null {
    const latest = listNamedWorkspaces(browserStorage());
    setItems(latest);
    setSelected(previous => {
      if (latest === null || !latest.length) return "";
      if (preferred && latest.some(item => item.name === preferred)) return preferred;
      return latest.some(item => item.name === previous) ? previous : latest[0].name;
    });
    return latest;
  }

  function save() {
    const target = name.normalize("NFC").trim();
    const latest = refresh();
    if (latest === null) {
      setMessage("보관함 데이터를 읽을 수 없습니다. 기존 데이터를 덮어쓰지 않았습니다.");
      return;
    }
    if (latest.some(item => item.name === target) &&
        !window.confirm("같은 이름의 보관본을 현재 작업 공간으로 교체할까요?"))
      return;
    const result = saveNamedWorkspace(tabStorage(),browserStorage(),target);
    if (!result) {
      setMessage("저장에 실패했습니다. 이름(1~40자), URL 등록 상태 및 브라우저 저장 공간을 확인하세요.");
      return;
    }
    refresh(result.name);
    setName(result.name);
    setMessage("'" + result.name + "' 구성(" + result.count + "개 URL)을 보관했습니다.");
  }

  function restore() {
    if (!selected || !window.confirm(
      "'" + selected + "' 구성으로 현재 탭의 URL·별칭·그룹·북마크·도킹 너비를 교체하고 새로고침할까요?",
    )) return;
    const result=restoreNamedWorkspace(tabStorage(),browserStorage(),selected);
    if (!result) {
      setMessage("복원하지 못했습니다. 현재 탭의 구성을 유지합니다.");
      return;
    }
    window.location.reload();
  }

  function rename() {
    if (!selected) return;
    const next=name.normalize("NFC").trim();
    const ok=renameNamedWorkspace(browserStorage(),selected,next);
    if (!ok) {
      setMessage("이름 변경에 실패했습니다. 1~40자의 고유한 이름을 입력하세요.");
      return;
    }
    refresh(next);
    setName(next);
    setMessage("'" + selected + "' 구성을 '" + next + "'(으)로 변경했습니다.");
  }

  function remove() {
    if (!selected || !window.confirm(
      "'" + selected + "' 보관본만 삭제할까요? 현재 탭과 다른 보관본은 유지됩니다.",
    )) return;
    const removed=selected;
    const ok=deleteNamedWorkspace(browserStorage(),selected);
    if (ok) {
      const remaining=refresh();
      setName(remaining?.[0]?.name ?? "");
    }
    setMessage(ok
      ? "'" + removed + "' 보관본을 삭제했습니다."
      : "보관본 삭제에 실패했습니다.");
  }

  return (
    <details className="workspace-named-library"
      onToggle={event=>{if(event.currentTarget.open) refresh();}}>
      <summary>이름별 작업 공간 관리</summary>
      <div className="workspace-named-library__content">
        <p>이 브라우저에서만 최대 {MAX_NAMED_WORKSPACES}개 구성을 수동 보관합니다.
          계정 동기화·실제 분석 결과 저장은 지원하지 않습니다.</p>
        {items === null && <p role="alert">보관함 형식이 유효하지 않습니다.
          기존 데이터를 자동으로 삭제하거나 덮어쓰지 않습니다.</p>}
        <label>
          보관 이름
          <input aria-label="작업 공간 보관 이름" type="text" value={name}
            maxLength={40} autoComplete="off"
            placeholder="예: 요리 채널 조사"
            onChange={event=>setName(event.target.value)}/>
        </label>
        <button type="button" disabled={items===null} onClick={save}>
          현재 구성 이름으로 보관
        </button>
        <label>
          보관된 구성 ({items?.length ?? 0}개)
          <select aria-label="보관된 작업 공간 선택" value={selected}
            onChange={event=>{
              setSelected(event.target.value);
              setName(event.target.value);
            }} disabled={!items?.length}>
            <option value="">구성 선택</option>
            {items?.map(item=><option value={item.name} key={item.name}>
              {item.name} · URL {item.count}개
            </option>)}
          </select>
        </label>
        <div className="workspace-named-library__actions">
          <button type="button" disabled={!selected} onClick={restore}>
            선택 구성 불러오기
          </button>
          <button type="button" disabled={!selected} onClick={rename}>
            이름 변경
          </button>
          <button type="button" disabled={!selected} onClick={remove}>
            선택 구성 삭제
          </button>
        </div>
        {!!message && <p role="status" className="workspace-named-library__feedback">
          {message}
        </p>}
      </div>
    </details>
  );
}
