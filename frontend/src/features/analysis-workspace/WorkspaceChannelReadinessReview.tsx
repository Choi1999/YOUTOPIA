import {useState} from "react";
import type {WorkspaceUrlTarget} from "./workspaceUrlTargets";
import {assessChannelReadiness} from "./workspaceChannelReadiness";
import "./workspace-readiness.css";

/**
 * A read-only evidence checklist, not an authorization or configuration form.
 * Inputs, API keys and Cloud Console credentials are never accepted here.
 * The evaluated policy snapshot is repository-backed and may not reflect
 * actual account state until independently verified by an authorized operator.
 */
export function WorkspaceChannelReadinessReview({
  targets,
}: Readonly<{targets:readonly WorkspaceUrlTarget[]}>) {
  const [expanded,setExpanded]=useState(false);
  const assessment=assessChannelReadiness(targets);

  return (
    <section className="workspace-readiness" aria-label="채널 실조회 준비 상태">
      <div className="workspace-readiness__heading">
        <div>
          <p className="workspace-readiness__eyebrow">UI-R04-H / EVIDENCE READINESS</p>
          <h3>실조회 준비 상태</h3>
          <p>GitHub에 기록된 정책 증빙만 평가합니다. Google Cloud 계정·API 키·실제 잔여 할당량을 조회한 결과가 아닙니다.</p>
        </div>
      </div>

      <div className="workspace-readiness__summary">
        <div className="workspace-readiness__decision">
          <strong>BLOCKED</strong>
          <span>실제 YouTube API 호출 금지</span>
        </div>
        <div>
          <strong>{assessment.verifiedGates}/{assessment.requiredGates}</strong>
          <span>확인된 승인 조건</span>
        </div>
        <div>
          <strong>POLICY_HOLD</strong>
          <span>저장소 정책 기준</span>
        </div>
      </div>

      <p className="workspace-readiness__source">
        출처: <code>{assessment.policyDocument}</code> ·
        기준일 {assessment.sourceReviewedOn ?? "확인 실패"} ·
        {assessment.sourceValid ? " 정책 문서 형식 검증됨" : " 정책 문서 검증 실패"}
      </p>
      <button type="button" className="workspace-readiness__toggle"
        aria-expanded={expanded} aria-controls="workspace-readiness-evidence"
        onClick={()=>setExpanded(open=>!open)}>
        {expanded ? "필수 증빙 목록 접기" : "실조회 전 필수 증빙 8항목 보기"}
      </button>

      {expanded && (
        <div id="workspace-readiness-evidence" className="workspace-readiness__details">
          <ol aria-label="실조회 전 필수 증빙">
            {assessment.gates.map(gate=>(
              <li key={gate.id}>
                <div className="workspace-readiness__gate-label">
                  <code>{gate.id}</code>
                  <strong>{gate.title}</strong>
                  <span>{gate.evidenceStatus}</span>
                </div>
                <p>{gate.evidenceNeeded}</p>
              </li>
            ))}
          </ol>

          {assessment.firstCall ? (
            <div className="workspace-readiness__first-call">
              <h4>첫 조회 후보 · 비실행 계획</h4>
              <dl>
                <div><dt>API</dt><dd>{assessment.firstCall.method} / {assessment.firstCall.part}</dd></div>
                <div><dt>필터</dt><dd>{assessment.firstCall.filter}</dd></div>
                <div><dt>대상 ID</dt><dd><code>{assessment.firstCall.targetId}</code></dd></div>
                <div><dt>최대 호출·예상 단위</dt><dd>1회 · 1단위</dd></div>
                <div><dt>운영자·승인</dt><dd>미지정 · 미승인</dd></div>
              </dl>
              <p>후보는 사용자 입력으로부터 만든 오프라인 제안일 뿐, 승인된 실행 대상이 아닙니다.</p>
            </div>
          ) : (
            <p>등록된 유효한 채널 조회 후보가 없습니다. 실조회 계획은 생성되지 않았습니다.</p>
          )}

          <p className="workspace-readiness__no-secrets">
            이 패널에는 API 키·비밀번호·접근 토큰·서비스 계정 JSON을 입력하지 마세요.
            승인 증빙은 별도 보호된 검토 경로로 확인해야 합니다. 화면에서 권한을 활성화할 수 없습니다.
          </p>
        </div>
      )}
    </section>
  );
}
