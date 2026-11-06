import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { readWorkspaceCatalog, type WorkspaceCatalogEntry } from "./analysisWorkspaceCatalog";
import {
  createDefaultWorkspaceSession, withWorkspacePair, withWorkspaceTopic,
} from "./analysisWorkspaceSession";
import { WorkspaceRelationExplorer } from "./WorkspaceRelationExplorer";

function Show({
  entries, start,
}: {
  entries: readonly WorkspaceCatalogEntry[];
  start?: ReturnType<typeof createDefaultWorkspaceSession>;
}) {
  const [session,setSession] = useState(start ?? createDefaultWorkspaceSession());
  return (
    <MemoryRouter>
      <WorkspaceRelationExplorer entries={entries} session={session}
        onSelect={(field,index,id) => setSession(s =>
          withWorkspacePair(s,field,index,id) ?? s)} />
      <output data-testid="selected-video-a">{session.videoIds[0]}</output>
    </MemoryRouter>
  );
}

describe("UI-R04-A — relation node interactions and evidence", () => {
  it("shows verified topic edges and selects a video into the original workspace session", async () => {
    const user=userEvent.setup();
    const entries=await readWorkspaceCatalog(demoAnalysisRepository);
    render(<Show entries={entries}/>);
    const graph=screen.getByRole("region",{name:"합성 관계 탐색"});
    expect(within(graph).getByRole("heading",{name:"영상 · 채널 · 주제 관계 탐색"}))
      .toBeInTheDocument();
    const nodeList=within(graph).getByRole("group",{name:"관계 노드 선택 목록"});
    await user.click(within(nodeList).getByRole("button",{name:/주제 RECIPE/}));
    const detail=within(graph).getByRole("complementary",{name:"선택 관계 근거"});
    const contributors=within(detail).getByRole("list",{name:"주제별 검증 영상 기여"});
    expect(within(contributors).getAllByRole("listitem")).toHaveLength(4);
    expect(within(contributors).getByText("38건")).toBeInTheDocument();
    await user.click(within(nodeList).getByRole("button",{name:/영상 B1/}));
    expect(within(detail).getByText("Cb0_-123xyz")).toBeInTheDocument();
    await user.click(within(detail).getByRole("button",{name:"영상 A에 선택"}));
    expect(screen.getByTestId("selected-video-a")).toHaveTextContent("Cb0_-123xyz");
  });

  it("suppresses missing numeric evidence while retaining curated synthetic membership", async () => {
    const repo:AnalysisRepository={
      async getSnapshot(target){
        return target.targetId === "Ab0_-123xyz"
          ? {kind:"NOT_FOUND"}
          : demoAnalysisRepository.getSnapshot(target);
      },
    };
    const entries=await readWorkspaceCatalog(repo);
    render(<Show entries={entries}/>);
    const graph=screen.getByRole("region",{name:"합성 관계 탐색"});
    const nodeList=within(graph).getByRole("group",{name:"관계 노드 선택 목록"});
    await userEvent.setup().click(within(nodeList).getByRole("button",{name:/영상 A1/}));
    const detail=within(graph).getByRole("complementary",{name:"선택 관계 근거"});
    expect(within(detail).getByText(/표본 수치와 감성값을 표시하지 않습니다/))
      .toBeInTheDocument();
    expect(within(detail).queryByText(/긍정 비율/)).not.toBeInTheDocument();
  });

  it("renders a safe empty state for no selected channels", async () => {
    const entries=await readWorkspaceCatalog(demoAnalysisRepository);
    let s=createDefaultWorkspaceSession();
    s=withWorkspacePair(s,"channelIds",0,"")!;
    s=withWorkspacePair(s,"channelIds",1,"")!;
    s=withWorkspaceTopic(s,"")!;
    render(<Show entries={entries} start={s}/>);
    const graph=screen.getByRole("region",{name:"합성 관계 탐색"});
    expect(within(graph).getByRole("status")).toHaveTextContent(/채널 A 또는 B/);
    expect(within(graph).queryByRole("group",{name:"관계 노드 선택 목록"}))
      .not.toBeInTheDocument();
  });
});
