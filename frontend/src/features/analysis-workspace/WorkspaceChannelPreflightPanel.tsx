import { useState } from "react";
import {
  planOfflineChannelMetadata,
  CHANNEL_PREFLIGHT_REVIEW_BUDGET,
} from "./workspaceChannelPreflight";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import "./workspace-preflight.css";

/**
 * A read-only diagnostic for registered channel URLs. It never dispatches
 * planned requests or manipulates the existing live collection policy.
 */
export function WorkspaceChannelPreflightPanel({
  targets,
}: Readonly<{targets: readonly WorkspaceUrlTarget[]}>) {
  const [detailsOpen,setDetailsOpen]=useState(false);
  if (!targets.some(t=>t.kind==="CHANNEL"||t.kind==="CHANNEL_HANDLE"))
    return null;

  const report=planOfflineChannelMetadata(targets);
  const invalid=report.budgetStatus==="INVALID_INPUT";
  const overBudget=report.budgetStatus==="BUDGET_EXCEEDED";
  return (
    <section className="analysis-workspace__panel workspace-preflight"
      aria-label="공개 채널 메타데이터 사전 검증">
      <div className="analysis-workspace__heading">
        <div>
          <p className="workspace-preflight__eyebrow">UI-R04-G / OFFLINE-ONLY</p>
          <h2>채널 메타데이터 조회 사전 검증</h2>
          <p>현재 등록한 채널 주소로 향후 요청 수와 허용 조건을 모의 계산합니다.
            실제 YouTube 요청이나 프로필 조회는 수행하지 않습니다.</p>
        </div>
      </div>
      <div className="workspace-preflight__facts" aria-label="예상 메타데이터 요청 집계">
        <div><span>등록 채널</span><strong>{report.channelTargets}개</strong></div>
        <div><span>요청 계획</span><strong>{report.operations.length}건</strong></div>
        <div><span>예상 API 비용</span><strong>{report.estimatedUnits}단위</strong></div>
        <div><span>실제 API 호출</span><strong>0건</strong></div>
      </div>
      <p role="status" className="workspace-preflight__gate">
        POLICY_HOLD · 실조회 차단 · {invalid
          ? "입력 검증 실패"
          : overBudget
            ? "사전 검토 예산 초과"
            : "검토용 계획만 생성됨"}
      </p>
      <p className="workspace-preflight__budget">
        임시 설계 검토 예산 {CHANNEL_PREFLIGHT_REVIEW_BUDGET}단위 ·
        예상치는 실제 Google Cloud 잔여 할당량이나 비용 청구액이 아닙니다.
      </p>
      <button type="button" className="workspace-preflight__toggle"
        aria-expanded={detailsOpen} aria-controls="workspace-channel-plan-details"
        onClick={()=>setDetailsOpen(value=>!value)}>
        {detailsOpen ? "요청 계획 접기" : "오프라인 요청 계획 보기"}
      </button>
      {detailsOpen && (
        <div className="workspace-preflight__details" id="workspace-channel-plan-details">
          {report.operations.length ? (
            <ol aria-label="사전 검증용 요청 계획">
              {report.operations.slice(0,8).map((operation,index)=>(
                <li key={operation.filter+":"+index}>
                  <strong>channels.list · {operation.filter}</strong>
                  <span>{operation.values.length}개 식별자 · snippet 조회 후보 ·
                    1단위 예상</span>
                  <code>{operation.values.join(", ")}</code>
                </li>
              ))}
            </ol>
          ) : <p>유효한 요청 계획이 없습니다. 실제 조회는 차단됩니다.</p>}
          {report.operations.length>8 && <p>전체 {report.operations.length}건 중
            처음 8건만 표시합니다. 표시 제한으로 요청이 실행되지는 않습니다.</p>}
          <p className="workspace-preflight__warning">
            실제 채널 ID 확인·프로필 이미지 조회를 활성화하려면 별도의
            정책·API 키·할당량·서버 승인 게이트가 필요합니다.
            이 화면에서 권한을 켤 수 없습니다.
          </p>
        </div>
      )}
    </section>
  );
}
