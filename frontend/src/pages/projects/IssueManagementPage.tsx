import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { DEMO_PROJECT_ID, getRoute } from "../../app/routeDefinitions";
import { useProjectDemo } from "../../features/project-demo/ProjectDemoProvider";
import {
  assignIssue,
  INITIAL_DEMO_ISSUES,
  transitionIssue,
  type DemoAssignee,
  type DemoIssueRecord,
  type IssuePermission,
  type IssueStatus,
  type IssueTransitionError,
} from "../../features/project-demo/issueBoardModel";
import { type DemoIssueId } from "../../features/project-demo/nexusDemoData";
import { useReviewWorkflow } from "../../features/project-demo/ReviewWorkflowProvider";
import { ProjectDataGuard } from "../../features/project-insights/ProjectDataGuard";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";

type BoardMode = "ACTIVE" | "EMPTY" | "UNAVAILABLE" | "PERMISSION_DENIED";

const columns: Array<{ status: IssueStatus; label: string }> = [
  { status: "WAITING", label: "검토 대기" },
  { status: "IN_PROGRESS", label: "진행 중" },
  { status: "COMPLETED", label: "검토 완료" },
];

const errorCopy: Record<IssueTransitionError, string> = {
  PERMISSION_DENIED: "권한이 없어 담당자 또는 상태를 변경할 수 없습니다.",
  HOLD_PROMOTION_BLOCKED: "PAY-002 HOLD 주장은 검토 완료나 승인 결론으로 승격할 수 없습니다.",
  INVALID_TRANSITION: "현재 상태에서 허용되지 않는 전이입니다.",
};

function isIssueId(value: string | null): value is DemoIssueId {
  return INITIAL_DEMO_ISSUES.some(({ id }) => id === value);
}

function IssueCard({ issue, selected, onSelect }: { issue: DemoIssueRecord; selected: boolean; onSelect: () => void }) {
  return (
    <button aria-pressed={selected} className={`kanban-issue-card${selected ? " selected" : ""}`} onClick={onSelect} type="button">
      <span className={`claim-status state-${issue.claimState.toLowerCase()}`}>{issue.id}</span>
      <strong>{issue.title}</strong>
      <p>{issue.summary}</p>
      <small>{issue.assignee === "UNASSIGNED" ? "담당자 미지정" : issue.assignee} · {issue.reviewDecision}</small>
    </button>
  );
}

export function IssueManagementPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { project, projectId: activeProjectId, collectionStatus } = useProjectDemo();
  const requestedIssue = searchParams.get("issue");
  const initialIssue: DemoIssueId = isIssueId(requestedIssue) ? requestedIssue : "PERF-001";
  const { issues, updateIssue: updateSharedIssue } = useReviewWorkflow();
  const [selectedId, setSelectedId] = useState<DemoIssueId>(initialIssue);
  const [permission, setPermission] = useState<IssuePermission>("EDITOR");
  const [boardMode, setBoardMode] = useState<BoardMode>("ACTIVE");
  const [announcement, setAnnouncement] = useState(
    requestedIssue && !isIssueId(requestedIssue)
      ? `${requestedIssue}는 지원하지 않아 PERF-001을 선택했습니다.`
      : `${initialIssue}을 선택했습니다.`,
  );
  const available = Boolean(
    project &&
    activeProjectId === DEMO_PROJECT_ID &&
    projectId === DEMO_PROJECT_ID &&
    collectionStatus === "SUCCEEDED",
  );
  const selected = useMemo(() => issues.find(({ id }) => id === selectedId) ?? issues[0], [issues, selectedId]);

  if (!available) {
    return (
      <ProductScreenFrame title="이슈 관리 · 담당자 검토">
        <ProjectDataGuard hasProject={Boolean(project)} title="이슈 보드에 필요한 완료 수집이 없습니다." />
      </ProductScreenFrame>
    );
  }

  function selectIssue(issueId: DemoIssueId) {
    setSelectedId(issueId);
    const next = new URLSearchParams(searchParams);
    next.set("issue", issueId);
    setSearchParams(next, { replace: true });
    setAnnouncement(`${issueId}을 선택했습니다.`);
  }

  function updateIssue(next: DemoIssueRecord, message: string) {
    updateSharedIssue(next);
    setAnnouncement(message);
  }

  function changeStatus(target: IssueStatus) {
    const result = transitionIssue(selected, target, permission);
    if (result.error) {
      setAnnouncement(errorCopy[result.error]);
      return;
    }
    updateIssue(result.issue, `${selected.id}: ${selected.status} → ${target} 로컬 전이를 기록했습니다.`);
  }

  function changeAssignee(assignee: DemoAssignee) {
    const result = assignIssue(selected, assignee, permission);
    if (result.error) {
      setAnnouncement(errorCopy[result.error]);
      return;
    }
    updateIssue(result.issue, `${selected.id} 담당자를 ${assignee}로 변경했습니다.`);
  }

  const effectiveMode = permission === "DENIED" ? "PERMISSION_DENIED" : boardMode;

  return (
    <ProductScreenFrame title="이슈 관리 · 담당자 검토">
      <div className="issue-board-toolbar">
        <p>NEXUS 시즌2 · 패치 2025.03.25 · 모든 작업은 브라우저 메모리의 시뮬레이션입니다.</p>
        <div>
          <label><span>보드 상태</span><select value={boardMode} onChange={(event) => setBoardMode(event.target.value as BoardMode)}>
            <option value="ACTIVE">ACTIVE</option><option value="EMPTY">EMPTY</option><option value="UNAVAILABLE">UNAVAILABLE</option><option value="PERMISSION_DENIED">PERMISSION_DENIED</option>
          </select></label>
          <label><span>데모 권한</span><select value={permission} onChange={(event) => setPermission(event.target.value as IssuePermission)}>
            <option value="EDITOR">EDITOR</option><option value="VIEWER">VIEWER</option><option value="DENIED">DENIED</option>
          </select></label>
        </div>
      </div>

      {effectiveMode === "EMPTY" && (
        <section className="issue-board-state" role="status"><span className="simulation-pill">DEMO / EMPTY</span><h2>표시할 이슈가 없습니다.</h2><p>빈 보드는 완료 또는 승인 상태를 뜻하지 않습니다.</p></section>
      )}
      {effectiveMode === "UNAVAILABLE" && (
        <section className="issue-board-state" role="alert"><span className="simulation-pill">DEMO / UNAVAILABLE</span><h2>이슈 보드를 사용할 수 없습니다.</h2><p>서버 장애를 흉내 낸 로컬 상태이며 기존 항목을 완료로 대체하지 않습니다.</p></section>
      )}
      {effectiveMode === "PERMISSION_DENIED" && (
        <section className="issue-board-state" role="alert"><span className="simulation-pill">DEMO / PERMISSION DENIED</span><h2>이슈 보드 접근 권한이 없습니다.</h2><p>미인증 데모 사용자는 승인이나 담당자 변경을 수행할 수 없습니다.</p></section>
      )}

      {effectiveMode === "ACTIVE" && (
        <>
          <section className="issue-kanban" aria-label="시뮬레이션 이슈 Kanban 보드">
            {columns.map((column) => (
              <div className={`kanban-column state-${column.status.toLowerCase()}`} key={column.status}>
                <h2>{column.label}</h2>
                <div>
                  {issues.filter(({ status }) => status === column.status || (column.status === "WAITING" && status === "REJECTED")).map((issue) => (
                    <IssueCard issue={issue} key={issue.id} onSelect={() => selectIssue(issue.id)} selected={selected.id === issue.id} />
                  ))}
                  {issues.every(({ status }) => status !== column.status && !(column.status === "WAITING" && status === "REJECTED")) && <p className="empty-kanban-column">항목 없음</p>}
                </div>
              </div>
            ))}
          </section>

          <section className="issue-review-panel" aria-labelledby="issue-review-title">
            <div className="issue-review-summary">
              <span className={`claim-status state-${selected.claimState.toLowerCase()}`}>{selected.claimState}</span>
              <h2 id="issue-review-title">{selected.id} · {selected.title}</h2>
              <p>{selected.summary}</p>
              <dl>
                <div><dt>현재 상태</dt><dd>{selected.status}</dd></div>
                <div><dt>검토 판정</dt><dd>{selected.reviewDecision}</dd></div>
                <div><dt>연결 근거</dt><dd>{selected.evidenceIds.length ? selected.evidenceIds.join(", ") : "연결 근거 없음"}</dd></div>
              </dl>
            </div>
            <div className="issue-review-controls">
              <label><span>담당자 · SIMULATED</span><select value={selected.assignee} onChange={(event) => changeAssignee(event.target.value as DemoAssignee)}>
                <option value="UNASSIGNED">UNASSIGNED</option><option value="DEMO_REVIEWER_A">DEMO_REVIEWER_A</option><option value="DEMO_REVIEWER_B">DEMO_REVIEWER_B</option>
              </select></label>
              <div aria-label={`${selected.id} 상태 전이`}>
                <button onClick={() => changeStatus("WAITING")} type="button">검토 대기</button>
                <button onClick={() => changeStatus("IN_PROGRESS")} type="button">진행 시작</button>
                <button onClick={() => changeStatus("COMPLETED")} type="button">검토 완료 시도</button>
                <button className="danger-action" onClick={() => changeStatus("REJECTED")} type="button">검토 반려</button>
              </div>
              <p className="review-announcement" aria-live="polite" role="status">{announcement}</p>
              <p className="review-auth-disclosure">DEMO_REVIEWER_UNAUTHENTICATED · 실제 사람 승인 또는 서버 감사 기록이 아닙니다.</p>
            </div>
            <div className="issue-audit-timeline">
              <h3>시뮬레이션 감사 타임라인</h3>
              <ol>{selected.audit.map((event) => <li key={event.id}><strong>{event.action}</strong><span>{event.timestamp}</span><p>{event.detail}</p><small>{event.actor}</small></li>)}</ol>
            </div>
          </section>
        </>
      )}

      <div className="issue-board-footer">
        <p role="alert">검증 보류 항목 PAY-002는 자동 완료 처리하거나 근거 있는 증가 결론으로 승격하지 않습니다.</p>
        <Link className="primary-action" to={getRoute("YU-12").href}>AI 워크스페이스 · 보고서 초안 →</Link>
      </div>
    </ProductScreenFrame>
  );
}
