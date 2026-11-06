import { useState } from "react";
import { Link } from "react-router-dom";
import type { StateScenario } from "./workspaceMetadataConsumerState";
import { USER_WORKSPACE_PATH } from "./workspaceDiagnosticsGate";
import "./workspace-diagnostics.css";

type Props = Readonly<{
  syntheticPreviewEnabled: boolean;
  onToggleSyntheticPreview?: () => void;
  syntheticServerAvailable: boolean;
  syntheticServerEnabled: boolean;
  syntheticServerStatus: string;
  onToggleSyntheticServer?: () => void;
  stateDemoAvailable: boolean;
  stateDemoEnabled: boolean;
  stateScenario: StateScenario;
  onStateScenarioChange?: (value: StateScenario) => void;
  onToggleStateDemo?: () => void;
  onRefreshStateDemo?: () => void;
  offlineConsumerAvailable?: boolean;
  offlineConsumerEnabled?: boolean;
  onToggleOfflineConsumer?: () => void;
}>;

/**
 * UI-R04-AC: all synthetic transport/fixture/test state controls have ONE
 * developer-only dock. This component is mounted exclusively by the gated
 * diagnostics route; never by the ordinary user workspace.
 */
export function WorkspaceDiagnosticsDock({
  syntheticPreviewEnabled, onToggleSyntheticPreview,
  syntheticServerAvailable, syntheticServerEnabled,
  syntheticServerStatus, onToggleSyntheticServer,
  stateDemoAvailable, stateDemoEnabled, stateScenario,
  onStateScenarioChange, onToggleStateDemo, onRefreshStateDemo,
  offlineConsumerAvailable = false, offlineConsumerEnabled = false,
  onToggleOfflineConsumer,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="workspace-diagnostics">
      <button type="button" aria-expanded={open}
        aria-controls="workspace-developer-diagnostics"
        onClick={() => setOpen(v => !v)}>
        {open ? "개발자 진단 닫기" : "개발자 진단 열기"}
      </button>
      {open && (
        <section id="workspace-developer-diagnostics"
          className="workspace-diagnostics__panel"
          role="region" aria-label="개발자 진단 도구">
          <div className="workspace-diagnostics__heading">
            <div>
              <strong>개발자 진단 · 합성 테스트 전용</strong>
              <p>실제 YouTube 조회·키 사용 없음 · 테스트 서버만 허용</p>
            </div>
            <button type="button" onClick={() => setOpen(false)}
              aria-label="개발자 진단 패널 닫기">닫기</button>
          </div>
          <div className="workspace-diagnostics__controls">
            {onToggleSyntheticPreview && (
              <button type="button" aria-pressed={syntheticPreviewEnabled}
                onClick={onToggleSyntheticPreview}>
                {syntheticPreviewEnabled ? "합성 정보 끄기" : "합성 정보 미리보기"}
              </button>
            )}
            {syntheticServerAvailable && onToggleSyntheticServer && (
              <button type="button" aria-pressed={syntheticServerEnabled}
                onClick={onToggleSyntheticServer}>
                {syntheticServerEnabled ? "Spring 합성 연결 끄기" : "Spring 합성 연결"}
              </button>
            )}
            {stateDemoAvailable && onToggleStateDemo && (
              <button type="button" aria-pressed={stateDemoEnabled}
                onClick={onToggleStateDemo}>
                {stateDemoEnabled ? "상태 QA 끄기" : "메타데이터 상태 QA"}
              </button>
            )}
            {stateDemoAvailable && stateDemoEnabled &&
              onStateScenarioChange && (
                <label>
                  메타데이터 QA 시나리오
                  <select aria-label="메타데이터 QA 시나리오"
                    value={stateScenario}
                    onChange={e => onStateScenarioChange(e.target.value as StateScenario)}>
                    <option value="READY">READY</option>
                    <option value="NOT_FOUND">NOT_FOUND</option>
                    <option value="FAILED">FAILED</option>
                    <option value="STALE">STALE</option>
                  </select>
                </label>
              )}
            {stateDemoAvailable && stateDemoEnabled && onRefreshStateDemo && (
              <button type="button" onClick={onRefreshStateDemo}>
                메타데이터 새로고침
              </button>
            )}
            {offlineConsumerAvailable && onToggleOfflineConsumer && (
              <button type="button" aria-pressed={offlineConsumerEnabled}
                onClick={onToggleOfflineConsumer}>
                {offlineConsumerEnabled ? "AF 정책 차단 QA 끄기" : "AF 정책 차단 QA"}
              </button>
            )}
          </div>
          <p role="status" className="workspace-diagnostics__status">
            {offlineConsumerEnabled ? "AF 테스트 전용 거부 응답 검수 · 실 제공자 조회 없음" :
              syntheticServerEnabled ? syntheticServerStatus :
              stateDemoEnabled ? "합성 메타데이터 상태 테스트 실행 중" :
              syntheticPreviewEnabled ? "브라우저 내부 합성 모드" :
              "조회하지 않음 · 진단 기능은 기본 비활성"}
          </p>
          <p className="workspace-diagnostics__notice">
            이 화면의 상태·제목·그래픽은 개발 검수 전용입니다.
            검증된 영상·채널 정보 또는 분석 결과가 아닙니다.
          </p>
          <Link to={USER_WORKSPACE_PATH}>일반 사용자 화면으로 이동</Link>
        </section>
      )}
    </div>
  );
}
