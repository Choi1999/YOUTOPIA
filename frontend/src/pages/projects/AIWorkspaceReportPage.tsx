import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { DEMO_PROJECT_ID } from "../../app/routeDefinitions";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import {
  buildAllowedEvidenceBundle,
  buildPromptPreview,
  buildReportDraft,
  DEMO_AI_TOOLS,
  transitionReportWorkflow,
  type DemoAiToolId,
  type EvidenceBundlePermission,
  type ReportWorkflowAction,
  type ReportWorkflowState,
} from "../../features/project-demo/reportDemoModel";
import { ProjectDataGuard } from "../../features/project-insights/ProjectDataGuard";
import { useReviewWorkflow } from "../../features/project-demo/ReviewWorkflowProvider";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

const stateCopy: Record<ReportWorkflowState, string> = {
  IDLE: "로컬 시뮬레이션을 시작할 준비가 되었습니다.",
  SIMULATED_RUNNING: "브라우저 안에서 결정적 보고서 초안을 구성하고 있습니다. 외부 요청은 없습니다.",
  SIMULATED_SUCCESS: "로컬 보고서 미리보기가 생성되었습니다. 정식 승인·저장·공유 상태가 아닙니다.",
  FAILED: "로컬 생성 실패를 시뮬레이션했습니다. 보고서가 저장되거나 승인되지 않았습니다.",
  RETRY: "재시도 준비 상태입니다. 동일한 고정 fixture로 다시 실행할 수 있습니다.",
  UNAVAILABLE: "선택한 외부 도구는 이 데모에서 사용할 수 없습니다. 실제 계정이나 모델 연결은 없습니다.",
  POLICY_BLOCKED: "권한 또는 외부 전달 정책 때문에 근거 번들과 실행이 차단되었습니다.",
  AWAITING_REVIEW: "초안이 생성되었지만 사람 검토 대기 중입니다. 검증된 결론으로 취급하지 않습니다.",
};

export function AIWorkspaceReportPage() {
  const { projectId } = useParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const { issues } = useReviewWorkflow();
  const [selectedTool, setSelectedTool] = useState<DemoAiToolId>("INTERNAL_AI");
  const [permission, setPermission] = useState<EvidenceBundlePermission>("LOCAL_MASKED_DEMO");
  const [workflowState, setWorkflowState] = useState<ReportWorkflowState>("IDLE");
  const bundle = useMemo(() => buildAllowedEvidenceBundle(permission), [permission]);
  const promptPreview = useMemo(() => buildPromptPreview(bundle), [bundle]);
  const draft = useMemo(() => buildReportDraft(bundle, issues), [bundle, issues]);
  const available = Boolean(
    project &&
    activeProjectId === DEMO_PROJECT_ID &&
    projectId === DEMO_PROJECT_ID &&
    collectionStatus === "SUCCEEDED",
  );

  if (!available) {
    return (
      <ProductScreenFrame title="AI 워크스페이스 · 보고서 공유">
        <ProjectDataGuard hasProject={Boolean(project)} title="AI 보고서에 필요한 완료 수집이 없습니다." />
      </ProductScreenFrame>
    );
  }

  function applyAction(action: ReportWorkflowAction) {
    setWorkflowState((current) => transitionReportWorkflow(current, action));
  }

  function chooseTool(toolId: DemoAiToolId) {
    setSelectedTool(toolId);
    if (toolId === "MCP") {
      applyAction("BLOCK_POLICY");
    } else if (toolId === "CHATGPT" || toolId === "CLAUDE") {
      applyAction("MARK_UNAVAILABLE");
    } else {
      applyAction("RESET");
    }
  }

  function changePermission(next: EvidenceBundlePermission) {
    setPermission(next);
    setWorkflowState(next === "DENIED" ? "POLICY_BLOCKED" : "IDLE");
  }

  const showDraft = Boolean(
    draft && (workflowState === "AWAITING_REVIEW" || workflowState === "SIMULATED_SUCCESS"),
  );

  return (
    <ProductScreenFrame title="AI 워크스페이스 · 보고서 공유">
      <div className="ai-workspace-intro">
        <p>NEXUS 시즌2 · 패치 2025.03.25 · YUTOPIA 시연 / 검증 상태를 우선합니다.</p>
        <span className="simulation-pill">DEMO / SIMULATED</span>
      </div>

      <div className="ai-workspace-grid">
        <section className="ai-tool-panel" aria-labelledby="ai-tools-title">
          <div className="panel-heading">
            <h2 id="ai-tools-title">연결 가능한 AI 도구</h2>
            <span>로컬 상태 시연</span>
          </div>
          <div className="ai-tool-list">
            {DEMO_AI_TOOLS.map((tool) => (
              <button
                aria-pressed={selectedTool === tool.id}
                className="ai-tool-card"
                key={tool.id}
                onClick={() => chooseTool(tool.id)}
                type="button"
              >
                <strong>{tool.label}</strong>
                <span>{tool.detail}</span>
                <small>{tool.availability}</small>
              </button>
            ))}
          </div>

          <label className="bundle-permission-field">
            <span>근거 번들 권한 · SIMULATED</span>
            <select
              onChange={(event) => changePermission(event.target.value as EvidenceBundlePermission)}
              value={permission}
            >
              <option value="LOCAL_MASKED_DEMO">LOCAL_MASKED_DEMO</option>
              <option value="DENIED">DENIED</option>
            </select>
          </label>
        </section>

        <section className="ai-evidence-panel" aria-labelledby="ai-evidence-title">
          <div className="panel-heading">
            <h2 id="ai-evidence-title">검증된 근거를 활용하는 AI</h2>
            <span>{bundle.policyState}</span>
          </div>
          <div className="evidence-bundle-summary">
            <strong>{bundle.id}</strong>
            <p>
              출처 {bundle.sourceIds.length}개 · 관측 {bundle.coverage.observedDays}/{bundle.coverage.expectedDays}일 ·
              비교 {bundle.comparability}
            </p>
            <ul>
              {bundle.sourceIds.map((sourceId) => <li key={sourceId}>{sourceId}</li>)}
            </ul>
          </div>
          <div className="prompt-preview" aria-labelledby="prompt-preview-title">
            <h3 id="prompt-preview-title">프롬프트 미리보기 · 외부 전송 없음</h3>
            <pre>{promptPreview}</pre>
          </div>
          <div className="evidence-policy-ledger">
            <p><strong>허용 관측 후보</strong> {bundle.allowedObservationIds.join(", ")} · 실제 결함 미검증</p>
            <p><strong>확정 결론 차단</strong> {bundle.blockedConclusionIds.join(", ")} · HOLD 유지</p>
            <p>{bundle.maskingDisclosure}</p>
            <p>{bundle.derivedMetricDisclosure}</p>
          </div>
        </section>

        <section className="report-preview-panel" aria-labelledby="report-preview-title">
          <div className="panel-heading">
            <h2 id="report-preview-title">보고서 · 공유</h2>
            <span>{workflowState}</span>
          </div>
          <p className="workflow-announcement" aria-live="polite" role="status">
            {stateCopy[workflowState]}
          </p>

          {workflowState === "IDLE" && (
            <button className="primary-action" onClick={() => applyAction("START")} type="button">
              로컬 초안 시뮬레이션
            </button>
          )}
          {workflowState === "SIMULATED_RUNNING" && (
            <div className="report-action-pair">
              <button className="primary-action" onClick={() => applyAction("COMPLETE_DRAFT")} type="button">초안 생성 완료</button>
              <button onClick={() => applyAction("FAIL")} type="button">실패 시뮬레이션</button>
            </div>
          )}
          {workflowState === "FAILED" && (
            <button className="primary-action" onClick={() => applyAction("PREPARE_RETRY")} type="button">재시도 준비</button>
          )}
          {workflowState === "RETRY" && (
            <button className="primary-action" onClick={() => applyAction("START")} type="button">동일 fixture로 다시 실행</button>
          )}
          {workflowState === "AWAITING_REVIEW" && (
            <button className="primary-action" onClick={() => applyAction("COMPLETE_PREVIEW")} type="button">검토 대기 초안 미리보기</button>
          )}
          {(workflowState === "UNAVAILABLE" || workflowState === "POLICY_BLOCKED") && (
            <button className="secondary-action" onClick={() => chooseTool("INTERNAL_AI")} type="button">내부 로컬 데모로 돌아가기</button>
          )}

          {showDraft && draft ? (
            <article className="report-draft" aria-label="시뮬레이션 보고서 초안">
              <span className="simulation-pill">DEMO / SIMULATED DRAFT</span>
              <h3>{draft.title}</h3>
              <small>{draft.generatedAt}</small>
              {draft.sections.map((section) => (
                <section key={section.id}>
                  <h4>{section.title}</h4>
                  <p>{section.body}</p>
                </section>
              ))}
              <div className="report-disclosures">
                {draft.disclosures.map((disclosure) => <p key={disclosure}>{disclosure}</p>)}
              </div>
            </article>
          ) : (
            <div className="report-empty-preview">
              <strong>보고서 미리보기 대기</strong>
              <p>허용된 마스킹 근거로 로컬 시뮬레이션을 완료한 뒤에만 초안을 표시합니다.</p>
            </div>
          )}

          <div className="blocked-share-actions" aria-label="차단된 외부 작업">
            <button disabled title="실제 파일 내보내기는 Cycle 8 범위가 아닙니다." type="button">내보내기</button>
            <button disabled title="공유 권한과 서버 기록이 없어 비활성화되었습니다." type="button">링크 공유</button>
            <button disabled title="실제 파일을 생성하지 않습니다." type="button">다운로드</button>
            <p>실제 내보내기·공유·다운로드·외부 도구 실행은 정책과 서버 계약이 없어 차단됩니다.</p>
          </div>
        </section>
      </div>

      <p className="ai-policy-footer" role="note">
        검증된 관측 사실과 실제 게임 결함·인과관계는 구분합니다. YouTube API 분석·재제공, OAuth, LLM, MCP,
        서버 저장은 실행하지 않습니다. 새로고침 시 인메모리 프로젝트와 보고서 초안이 사라집니다.
      </p>
    </ProductScreenFrame>
  );
}
