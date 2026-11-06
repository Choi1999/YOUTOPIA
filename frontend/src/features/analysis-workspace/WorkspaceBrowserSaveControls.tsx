import { useState } from "react";
import {
  deleteBrowserWorkspace, inspectBrowserWorkspace,
  restoreWorkspaceFromBrowser, saveWorkspaceToBrowser,
  type WorkspaceBrowserBackupInfo,
} from "./workspaceBrowserSnapshot";
import "./workspace-browser-snapshot.css";

function tabStorage(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}
function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Explicit opt-in, same-browser only. Never auto-restores or makes API calls. */
export function WorkspaceBrowserSaveControls() {
  const [info, setInfo] = useState<WorkspaceBrowserBackupInfo | null>(
    () => inspectBrowserWorkspace(browserStorage()),
  );
  const [message, setMessage] = useState("");

  function save() {
    if (inspectBrowserWorkspace(browserStorage()) &&
        !window.confirm("이 브라우저에 보관된 이전 작업 공간을 현재 내용으로 덮어쓸까요?"))
      return;
    const result = saveWorkspaceToBrowser(tabStorage(), browserStorage());
    setInfo(result ?? inspectBrowserWorkspace(browserStorage()));
    setMessage(result
      ? "등록 대상 " + result.count + "개를 이 브라우저에 보관했습니다."
      : "보관하지 못했습니다. 등록된 URL과 브라우저 저장소를 확인하세요.");
  }

  function restore() {
    const saved = inspectBrowserWorkspace(browserStorage());
    if (!saved) {
      setInfo(null);
      setMessage("보관된 작업 공간이 없거나 형식이 유효하지 않습니다.");
      return;
    }
    if (!window.confirm(
      "현재 탭의 URL·별칭·그룹·북마크·도킹 너비가 보관된 내용으로 교체되고 페이지가 새로고침됩니다. 계속할까요?",
    )) return;
    const result = restoreWorkspaceFromBrowser(tabStorage(), browserStorage());
    if (!result) {
      setMessage("복원하지 못했습니다. 현재 작업 공간은 그대로 유지합니다.");
      return;
    }
    window.location.reload();
  }

  function remove() {
    if (!window.confirm("이 브라우저의 보관본만 삭제할까요? 현재 탭의 작업 공간은 유지됩니다."))
      return;
    const success = deleteBrowserWorkspace(browserStorage());
    if (success) setInfo(null);
    setMessage(success
      ? "브라우저 보관본을 삭제했습니다. 현재 탭은 유지됩니다."
      : "보관본을 삭제하지 못했습니다.");
  }

  return (
    <details className="workspace-browser-snapshot">
      <summary>작업 공간 보관</summary>
      <div className="workspace-browser-snapshot__body">
        <p>이 브라우저에만 수동 보관합니다. 다른 PC·계정과 동기화하지 않습니다.
          영상·채널 식별자, 직접 작성한 이름·그룹·북마크·도킹 너비만 저장합니다.
          실제 분석 결과와 API 키는 저장하지 않습니다.</p>
        <p className="workspace-browser-snapshot__info">
          {info
            ? "보관된 URL " + info.count + "개 · " +
              new Date(info.savedAt).toLocaleString()
            : "유효한 보관본 없음"}
        </p>
        <div className="workspace-browser-snapshot__buttons">
          <button type="button" onClick={save}>현재 구성 보관</button>
          <button type="button" onClick={restore}>보관본 불러오기</button>
          <button type="button" onClick={remove}>보관본 삭제</button>
        </div>
        {message && <p role="status" className="workspace-browser-snapshot__feedback">
          {message}
        </p>}
      </div>
    </details>
  );
}
