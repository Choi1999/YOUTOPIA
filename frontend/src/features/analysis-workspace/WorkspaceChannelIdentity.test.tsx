import {render,screen} from "@testing-library/react";
import {describe,expect,it} from "vitest";
import {WorkspaceChannelIdentity} from "./WorkspaceChannelIdentity";
import {WorkspaceTargetArtwork} from "./WorkspaceTargetArtwork";
import {ApprovedChannelProfileCache} from "./workspaceChannelProfile";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";

const channelId="UC"+"A".repeat(22);
const url="https://yt3.ggpht.com/a-/AOh14Gg_photo=s240";
const now=Date.now();
const record={
  source:"APPROVED_CHANNEL_SNIPPET" as const,
  channelId,
  handle:"@example.channel",
  title:"Demo approved-source profile (test only)",
  thumbnailUrl:url,
  retrievedAt:now,
};
const registered=addWorkspaceUrlTargets([],[
  "https://www.youtube.com/@Example.Channel",
  "https://www.youtube.com/channel/"+channelId,
].join("\n")).targets;
const handle=registered.find(t=>t.kind==="CHANNEL_HANDLE")!;
const channel=registered.find(t=>t.kind==="CHANNEL")!;

describe("UI-R04-F — channel identity UI and profile image gating",()=>{
  it("marks handle and channel ID separately without inventing ownership or images",()=>{
    render(<>
      <WorkspaceChannelIdentity target={handle}/>
      <WorkspaceChannelIdentity target={channel}/>
      <WorkspaceTargetArtwork target={handle} variant="node" allowVideoImage/>
      <WorkspaceTargetArtwork target={channel} variant="detail" allowVideoImage/>
    </>);
    expect(screen.getByText("핸들 등록 · 채널 ID 해석 대기")).toBeInTheDocument();
    expect(screen.getByText("채널 ID 형식 확인 · 실제 채널 미검증")).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(document.querySelectorAll('[data-channel-profile="POLICY_HOLD"]')).toHaveLength(2);
  });

  it("accepts an injected approved record but requires separate channel image consent",()=>{
    const profiles=new ApprovedChannelProfileCache();
    expect(profiles.put(record,now)).toBe(true);
    render(<>
      <WorkspaceChannelIdentity target={handle} profiles={profiles}/>
      <WorkspaceTargetArtwork target={handle} variant="detail" channelProfiles={profiles}/>
    </>);
    expect(screen.getByText("핸들 → 채널 ID 확인")).toBeInTheDocument();
    expect(screen.getByText(/Demo approved-source profile/)).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("loads only the validated channel image with explicit separate consent",()=>{
    const profiles=new ApprovedChannelProfileCache();
    expect(profiles.put(record,now)).toBe(true);
    render(<WorkspaceTargetArtwork target={channel} variant="detail"
      channelProfiles={profiles} allowChannelImage/>);
    const image=document.querySelector("img");
    expect(image).toHaveAttribute("src",url);
    expect(image).toHaveAttribute("referrerpolicy","no-referrer");
    expect(image).toHaveAttribute("loading","lazy");
    expect(screen.getByText(/분석 데이터 아님/)).toBeInTheDocument();
  });

  it("refuses an unrelated handle profile even if cache has approved data",()=>{
    const profiles=new ApprovedChannelProfileCache();
    expect(profiles.put(record,now)).toBe(true);
    const unrelated=addWorkspaceUrlTargets([],"https://youtube.com/@UnrelatedCreator").targets[0];
    render(<WorkspaceTargetArtwork target={unrelated} variant="detail"
      channelProfiles={profiles} allowChannelImage/>);
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });
});
