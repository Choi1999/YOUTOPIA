import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { INITIAL_DEMO_ISSUES, type DemoIssueRecord } from "./issueBoardModel";
import { useProjectDemo } from "./ProjectDemoProvider";

type ReviewWorkflowContextValue = {
  issues: DemoIssueRecord[];
  updateIssue: (issue: DemoIssueRecord) => void;
};

const ReviewWorkflowContext = createContext<ReviewWorkflowContextValue | null>(null);

function cloneInitialIssues() {
  return INITIAL_DEMO_ISSUES.map((issue) => ({ ...issue, audit: [...issue.audit] }));
}

export function ReviewWorkflowProvider({ children }: { children: ReactNode }) {
  const { projectId } = useProjectDemo();
  const [issues, setIssues] = useState<DemoIssueRecord[]>(cloneInitialIssues);
  const previousProjectId = useRef(projectId);

  useEffect(() => {
    if (previousProjectId.current !== projectId) {
      setIssues(cloneInitialIssues());
      previousProjectId.current = projectId;
    }
  }, [projectId]);

  const value = useMemo<ReviewWorkflowContextValue>(
    () => ({
      issues,
      updateIssue: (nextIssue) => {
        setIssues((current) => current.map((issue) => issue.id === nextIssue.id ? nextIssue : issue));
      },
    }),
    [issues],
  );

  return <ReviewWorkflowContext.Provider value={value}>{children}</ReviewWorkflowContext.Provider>;
}

export function useReviewWorkflow() {
  const context = useContext(ReviewWorkflowContext);
  if (!context) throw new Error("useReviewWorkflow must be used within ReviewWorkflowProvider");
  return context;
}
