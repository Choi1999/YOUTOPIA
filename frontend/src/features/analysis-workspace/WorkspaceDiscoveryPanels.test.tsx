import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import { createDefaultWorkspaceSession, withWorkspacePair } from "./analysisWorkspaceSession";
import { WorkspaceDiscoveryPanels } from "./WorkspaceDiscoveryPanels";

function TestHarness({repository=demoAnalysisRepository}: {repository?:AnalysisRepository}) {
  const [session,setSession]=useState(createDefaultWorkspaceSession);
  return (
    <AnalysisRepositoryProvider repository={repository}>
      <MemoryRouter>
        <WorkspaceDiscoveryPanels session={session} onSelect={(field,index,id) => {
          setSession(old => withWorkspacePair(old,field,index,id) ?? old);
        }}/>
      </MemoryRouter>
    </AnalysisRepositoryProvider>
  );
}

describe("YU-53/54 — integrated summary and local catalogue UI", () => {
  it("renders grounded individual denominators, not a fabricated combined total", async () => {
    render(<TestHarness/>);
    const summary = screen.getByRole("region",{name:"통합 분석 요약"});
    expect((await within(summary).findAllByText(/분류 완료 80건/)).length).toBe(2);
    expect(within(summary).getByText(/분류 완료 160건/)).toBeInTheDocument();
    expect(within(summary).getByText(/분류 완료 140건/)).toBeInTheDocument();
    expect(within(summary).getByRole("list",{name:"선정 채널별 주제 언급량"}))
      .toHaveTextContent("63건");
    expect(within(summary).getByText(/표본을 서로 합산하지 않습니다/)).toBeInTheDocument();
  });

  it("filters by topic and type, then selects an allowlisted target into VIDEO A", async () => {
    const user=userEvent.setup();
    render(<TestHarness/>);
    const catalogue = screen.getByRole("region",{name:"분석 대상 검색"});
    expect(await within(catalogue).findByText("검색 결과 6개 / 등록 6개"))
      .toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox",{name:"대상 종류"}),"CHANNEL");
    await user.selectOptions(screen.getByRole("combobox",{name:"주제 언급"}),"QUALITY");
    expect(within(catalogue).getByText("검색 결과 1개 / 등록 6개")).toBeInTheDocument();
    const list=within(catalogue).getByRole("list",{name:"등록 합성 분석 대상 목록"});
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText(demoChannelSelections[1].channelId)).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"검색 필터 초기화"}));
    await user.type(screen.getByRole("searchbox",{name:"ID·이름 검색"}),"Cb0_");
    const filteredList=within(catalogue).getByRole("list",{name:"등록 합성 분석 대상 목록"});
    expect(within(filteredList).getAllByRole("listitem")).toHaveLength(1);
    await user.click(within(filteredList).getByRole("button",{name:"A에 선택"}));
    const summary=screen.getByRole("region",{name:"통합 분석 요약"});
    expect(within(summary).getByText(/영상 A · Cb0_-123xyz/)).toBeInTheDocument();
  });

  it("does not show metrics or fake ready targets when the repository has no data", async () => {
    const repo:AnalysisRepository={async getSnapshot(){return {kind:"NOT_FOUND"};}};
    render(<TestHarness repository={repo}/>);
    const summary=screen.getByRole("region",{name:"통합 분석 요약"});
    expect((await within(summary).findAllByText(/NOT_FOUND/)).length).toBeGreaterThan(0);
    expect(within(summary).queryByText(/분류 완료 80건/)).not.toBeInTheDocument();
    const catalogue=screen.getByRole("region",{name:"분석 대상 검색"});
    await within(catalogue).findByText("검색 결과 6개 / 등록 6개");
    await userEvent.setup().selectOptions(screen.getByRole("combobox",{name:"분석 상태"}),"READY");
    expect(within(catalogue).getByText("검색 결과 0개 / 등록 6개")).toBeInTheDocument();
    expect(within(catalogue).getByText(/미등록 대상을 자동 생성하지 않습니다/)).toBeInTheDocument();
  });
});
