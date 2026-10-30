import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { DEMO_PROJECT_ID } from "../../app/routeDefinitions";
import {
  DEMO_COMPARISON_WINDOWS,
  DEMO_OBSERVATION_WINDOW,
  DEMO_SOURCE_VIDEOS,
  type DemoSourceVideo,
  type CollectionStatus,
} from "./nexusDemoData";

export type { CollectionStatus } from "./nexusDemoData";

export type DemoVideo = DemoSourceVideo;

export type ProjectDraft = {
  projectName: string;
  game: string;
  eventName: string;
  eventDate: string;
  observationStart: string;
  observationEnd: string;
  selectedVideoIds: string[];
  analysisPurpose: string;
};

export type ProjectDraftErrors = Partial<
  Record<keyof Omit<ProjectDraft, "selectedVideoIds"> | "selectedVideos" | "observationPeriod", string>
>;

export { DEMO_COMPARISON_WINDOWS, DEMO_OBSERVATION_WINDOW } from "./nexusDemoData";

export const DEMO_VIDEOS: DemoVideo[] = DEMO_SOURCE_VIDEOS;

export const NEXUS_DEMO_DRAFT: ProjectDraft = {
  projectName: "NEXUS 시즌2 · v1.4 업데이트",
  game: "NEXUS 시즌2",
  eventName: "v1.4 업데이트",
  eventDate: "2025-03-25",
  observationStart: DEMO_OBSERVATION_WINDOW.start,
  observationEnd: DEMO_OBSERVATION_WINDOW.end,
  selectedVideoIds: DEMO_VIDEOS.map((video) => video.id),
  analysisPurpose: "유저 반응 · 패치 전후 관측",
};

export const EMPTY_PROJECT_DRAFT: ProjectDraft = {
  projectName: "",
  game: "",
  eventName: "",
  eventDate: "",
  observationStart: "",
  observationEnd: "",
  selectedVideoIds: ["", "", ""],
  analysisPurpose: "",
};

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

export function validateProjectDraft(draft: ProjectDraft): ProjectDraftErrors {
  const errors: ProjectDraftErrors = {};

  if (!draft.projectName.trim()) errors.projectName = "프로젝트 이름을 입력해 주세요.";
  if (!draft.game.trim()) errors.game = "대상 게임을 입력해 주세요.";
  if (!draft.eventName.trim()) errors.eventName = "사건 또는 업데이트를 입력해 주세요.";
  if (!draft.analysisPurpose.trim()) errors.analysisPurpose = "분석 목적을 입력해 주세요.";

  if (!draft.eventDate) errors.eventDate = "사건 날짜를 입력해 주세요.";
  else if (!isValidIsoDate(draft.eventDate)) errors.eventDate = "유효한 사건 날짜를 입력해 주세요.";
  else if (draft.eventDate !== "2025-03-25") {
    errors.eventDate = "NEXUS 시즌2 데모의 사건 날짜는 2025-03-25로 고정됩니다.";
  }

  if (!draft.observationStart || !draft.observationEnd) {
    errors.observationPeriod = "관측 시작일과 종료일을 모두 입력해 주세요.";
  } else if (!isValidIsoDate(draft.observationStart) || !isValidIsoDate(draft.observationEnd)) {
    errors.observationPeriod = "유효한 관측 기간을 입력해 주세요.";
  } else if (draft.observationStart > draft.observationEnd) {
    errors.observationPeriod = "관측 시작일은 종료일보다 늦을 수 없습니다.";
  } else if (
    draft.observationStart > DEMO_COMPARISON_WINDOWS.before.start ||
    draft.observationEnd < DEMO_COMPARISON_WINDOWS.after.end
  ) {
    errors.observationPeriod =
      "관측 기간은 비교 구간 2025-03-11부터 2025-04-07까지를 모두 포함해야 합니다.";
  } else if (
    isValidIsoDate(draft.eventDate) &&
    (draft.eventDate < draft.observationStart || draft.eventDate > draft.observationEnd)
  ) {
    errors.observationPeriod = "사건 날짜는 관측 기간 안에 있어야 합니다.";
  }

  const selected = draft.selectedVideoIds.filter(Boolean);
  if (selected.length !== 3) {
    errors.selectedVideos = "공식 영상 3개를 모두 선택해 주세요.";
  } else if (new Set(selected).size !== selected.length) {
    errors.selectedVideos = "같은 영상을 중복 선택할 수 없습니다.";
  } else if (selected.some((id) => !DEMO_VIDEOS.some((video) => video.id === id))) {
    errors.selectedVideos = "지원되는 NEXUS 데모 영상만 선택할 수 있습니다.";
  }

  return errors;
}

type ProjectDemoContextValue = {
  project: ProjectDraft | null;
  projectId: string | null;
  collectionStatus: CollectionStatus | null;
  attempt: number;
  createProject: (draft: ProjectDraft) => string;
  setCollectionStatus: (status: CollectionStatus) => void;
  retryCollection: () => void;
  resetDemo: () => void;
};

const ProjectDemoContext = createContext<ProjectDemoContextValue | null>(null);

export function ProjectDemoProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectDraft | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [attempt, setAttempt] = useState(1);

  const value = useMemo<ProjectDemoContextValue>(
    () => ({
      project,
      projectId: project ? DEMO_PROJECT_ID : null,
      collectionStatus,
      attempt,
      createProject: (draft) => {
        setProject({ ...draft, selectedVideoIds: [...draft.selectedVideoIds] });
        setCollectionStatus("QUEUED");
        setAttempt(1);
        return DEMO_PROJECT_ID;
      },
      setCollectionStatus,
      retryCollection: () => {
        setAttempt((current) => current + 1);
        setCollectionStatus("QUEUED");
      },
      resetDemo: () => {
        setProject(null);
        setCollectionStatus(null);
        setAttempt(1);
      },
    }),
    [attempt, collectionStatus, project],
  );

  return <ProjectDemoContext.Provider value={value}>{children}</ProjectDemoContext.Provider>;
}

export function useProjectDemo() {
  const context = useContext(ProjectDemoContext);
  if (!context) throw new Error("useProjectDemo must be used within ProjectDemoProvider");
  return context;
}
