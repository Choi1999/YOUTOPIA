import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AnalysisRepositoryProvider } from "../analysis/data/AnalysisRepositoryContext";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { AnalysisWorkspacePage } from "../../pages/analysis/AnalysisWorkspacePage";
import { PROVIDER_METADATA_RESPONSE_SCHEMA,
  type ProviderMetadataReader } from "./workspaceProviderMetadata";
import { WORKSPACE_TARGET_PRESENTATION_KEY } from "./workspaceTargetPresentation";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";

function response(target: Pick<WorkspaceUrlTarget,"kind"|"id">) {
  const now=Date.now();
  return {
    schema:PROVIDER_METADATA_RESPONSE_SCHEMA,
    source:"AUTHORIZED_BACKEND",
    sourceAuthenticated:true,
    status:"READY",
    kind:target.kind,requestedId:target.id,
    title:"오프라인 계약 시험 제목",
    channelTitle:target.kind==="VIDEO"?"오프라인 계약 시험 채널":null,
    thumbnailUrl:target.kind==="VIDEO"
      ? "https://i.ytimg.com/vi/Ab0_-123xyz/hqdefault.jpg" : null,
    observedAt:now-100,expiresAt:now+60_000,
  };
}

function mount(reader?: ProviderMetadataReader) {
  return render(
    <AnalysisRepositoryProvider repository={demoAnalysisRepository}>
      <MemoryRouter initialEntries={["/analysis/youtube/workspace"]}>
        <Routes><Route path="/analysis/youtube/workspace"
          element={<AnalysisWorkspacePage providerMetadataReader={reader}/>}/></Routes>
      </MemoryRouter>
    </AnalysisRepositoryProvider>,
  );
}
async function addVideo() {
  const user=userEvent.setup();
  const dialog=screen.getByRole("dialog",{name:"그래프 집중 탐색"});
  await user.type(within(dialog).getByRole("textbox",{name:"URL 추가 입력"}),
    "https://youtu.be/Ab0_-123xyz");
  await user.click(within(dialog).getByRole("button",{name:"추가하기"}));
  return {user,dialog};
}

afterEach(()=>{
  sessionStorage.clear();
  document.body.style.overflow="";
});

describe("UI-R04-AE — inert product route and offline-injected reader integration",()=>{
  it("does not request or display provider information without an injected reader",async()=>{
    mount();
    const {dialog}=await addVideo();
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    expect(within(detail).getByRole("heading",{name:"영상 제목 미확인"}))
      .toBeInTheDocument();
    expect(detail.querySelector("[data-provider-status]")).toBeNull();
    expect(within(detail).getByText("링크 등록 · 실제 제공자 정보 미확인"))
      .toBeInTheDocument();
  });

  it("projects only target-matched, unexpired backend data while keeping consent and user alias",async()=>{
    // Simulated trusted application reader supplied ONLY to this unit test;
    // no real Spring/Google endpoint is contacted by the product route.
    const reader:ProviderMetadataReader=async target=>response(target);
    mount(reader);
    const {user,dialog}=await addVideo();
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});

    await waitFor(()=>expect(within(detail).getByRole("heading",{
      name:"오프라인 계약 시험 제목",
    })).toBeInTheDocument());
    expect(within(detail).getByText(/백엔드 제공 채널명: 오프라인 계약 시험 채널/))
      .toBeInTheDocument();
    expect(within(detail).getByText(/소속 관계 미검증/))
      .toBeInTheDocument();
    expect(detail.querySelector('[data-provider-status="READY"]'))
      .toBeInTheDocument();
    expect(dialog.querySelector('img[src^="https://i.ytimg.com/"]'))
      .not.toBeInTheDocument();
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY))
      .toBeNull();

    await user.click(within(dialog).getByRole("button",{name:"영상 이미지 켜기"}));
    expect(dialog.querySelector(
      'img[src="https://i.ytimg.com/vi/Ab0_-123xyz/hqdefault.jpg"]'))
      .toBeInTheDocument();

    await user.click(within(detail).getByText("표시 제목·이미지 편집"));
    await user.type(within(detail).getByRole("textbox",{
      name:"표시 제목 (직접 입력)",
    }),"사용자 지정 제목");
    await user.click(within(detail).getByRole("button",{name:"표시 제목 저장"}));
    expect(within(detail).getByRole("heading",{name:"사용자 지정 제목"}))
      .toBeInTheDocument();
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY))
      .toContain("사용자 지정 제목");
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY))
      .not.toContain("오프라인 계약 시험 제목");
  });

  it("never displays a mismatched backend title on the registered video",async()=>{
    const reader:ProviderMetadataReader=async target=>({
      ...response(target),requestedId:"Mismatched0",
    });
    mount(reader);
    const {dialog}=await addVideo();
    const detail=within(dialog).getByRole("complementary",{name:"도킹 선택 상세"});
    await waitFor(()=>expect(detail.querySelector(
      '[data-provider-status="FAILED"]')).toBeInTheDocument());
    expect(within(detail).getByRole("heading",{name:"영상 제목 미확인"}))
      .toBeInTheDocument();
    expect(within(detail).queryByText("오프라인 계약 시험 제목"))
      .not.toBeInTheDocument();
  });
});
