import {afterEach,describe,expect,it} from "vitest";
import {
  addWorkspaceUrlTargets,clearWorkspaceUrlTargets,parseWorkspaceYouTubeUrl,
  readWorkspaceUrlTargets,writeWorkspaceUrlTargets,
  WORKSPACE_URL_TARGETS_KEY,WORKSPACE_URL_TARGETS_TTL_MS,
  WORKSPACE_MAX_URL_TARGETS,
} from "./workspaceUrlTargets";

const VIDEO = "Ab0_-123xyz";
const CHANNEL = "UC" + "A".repeat(22);
const T = 1_000_000;

afterEach(()=>sessionStorage.clear());

describe("UI-R04-B — canonical offline-only YouTube URL intake",()=>{
  it("canonicalizes watch, share, shorts, live and channel ID URLs",()=>{
    for (const url of [
      "https://www.youtube.com/watch?v="+VIDEO+"&si=tracking&t=30",
      "https://youtu.be/"+VIDEO+"?si=tracking",
      "https://m.youtube.com/shorts/"+VIDEO+"?feature=share",
      "https://youtube.com/live/"+VIDEO,
      "https://www.youtube-nocookie.com/embed/"+VIDEO,
    ]) expect(parseWorkspaceYouTubeUrl(url))
      .toEqual({kind:"VIDEO",id:VIDEO,canonicalUrl:"https://www.youtube.com/watch?v="+VIDEO});
    expect(parseWorkspaceYouTubeUrl("https://youtube.com/channel/"+CHANNEL))
      .toEqual({kind:"CHANNEL",id:CHANNEL,canonicalUrl:"https://www.youtube.com/channel/"+CHANNEL});
    expect(parseWorkspaceYouTubeUrl("https://youtube.com/@MyChannel/videos"))
      .toEqual({kind:"CHANNEL_HANDLE",id:"@mychannel",canonicalUrl:"https://www.youtube.com/@mychannel"});
  });

  it("rejects spoofed hosts, credentials, invalid IDs and ambiguous watch fields",()=>{
    for (const url of [
      "https://www.youtube.com.evil.example/watch?v="+VIDEO,
      "javascript:alert(1)",
      "file:///etc/passwd",
      "https://user:pass@youtube.com/watch?v="+VIDEO,
      "https://youtube.com:9999/watch?v="+VIDEO,
      "https://youtu.be/not-valid",
      "https://youtube.com/watch?v="+VIDEO+"&v=Cb0_-123xyz",
      "https://youtube.com/playlist?list=abc",
      "https://youtube.com/redirect?q=https://evil.example/",
      "https://youtube.com/@a",
      "https://youtube.com/channel/UCwrong",
    ]) expect(parseWorkspaceYouTubeUrl(url)).toBeNull();
  });

  it("adds multiple URLs beyond the A/B comparison slot limit and deduplicates variants",()=>{
    const input = [
      "https://youtu.be/"+VIDEO,
      "https://www.youtube.com/watch?v="+VIDEO+"&t=8",
      "https://www.youtube.com/@CreatorOne",
      "https://www.youtube.com/channel/"+CHANNEL,
      "https://www.youtube.com/shorts/Cb0_-123xyz",
      "https://fake.example/watch?v="+VIDEO,
    ].join("\n");
    const result=addWorkspaceUrlTargets([],input,T);
    expect(result.targets).toHaveLength(4);
    expect(result.added).toHaveLength(4);
    expect(result.duplicates).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.targets.find(t=>t.id==="@creatorone")?.kind).toBe("CHANNEL_HANDLE");
    expect(JSON.stringify(result.targets)).not.toContain("t=8");
  });

  it("enforces UI capacity for performance, not an A/B business limit",()=>{
    const existing = Array.from({length:WORKSPACE_MAX_URL_TARGETS},(_,i)=>({
      kind:"VIDEO" as const,id:"A"+i.toString(36).padStart(10,"0"),
      canonicalUrl:"https://www.youtube.com/watch?v="+"A"+i.toString(36).padStart(10,"0"),
      addedAt:T,
    }));
    const result=addWorkspaceUrlTargets(existing,"https://youtu.be/"+VIDEO,T);
    expect(result.added).toHaveLength(0);
    expect(result.capacityReached).toBe(true);
    expect(result.targets).toHaveLength(WORKSPACE_MAX_URL_TARGETS);
  });

  it("stores only bounded canonical IDs per tab and respects a 2h TTL",()=>{
    const result=addWorkspaceUrlTargets([],"https://youtu.be/"+VIDEO+"?si=private",T);
    expect(writeWorkspaceUrlTargets(sessionStorage,result.targets,T)).toBe(true);
    expect(readWorkspaceUrlTargets(sessionStorage,T+1)).toEqual(result.targets);
    expect(sessionStorage.getItem(WORKSPACE_URL_TARGETS_KEY))
      .not.toContain("si=private");
    expect(readWorkspaceUrlTargets(sessionStorage,T+WORKSPACE_URL_TARGETS_TTL_MS+1))
      .toEqual([]);
    expect(clearWorkspaceUrlTargets(sessionStorage)).toBe(true);
    expect(sessionStorage.getItem(WORKSPACE_URL_TARGETS_KEY)).toBeNull();
  });

  it("fails closed for polluted or unavailable storage without networking",()=>{
    const result=addWorkspaceUrlTargets([],"https://youtu.be/"+VIDEO,T);
    expect(writeWorkspaceUrlTargets(sessionStorage,result.targets,T)).toBe(true);
    const original=JSON.parse(sessionStorage.getItem(WORKSPACE_URL_TARGETS_KEY)!);
    sessionStorage.setItem(WORKSPACE_URL_TARGETS_KEY,
      JSON.stringify({...original,token:"secret"}));
    expect(readWorkspaceUrlTargets(sessionStorage,T)).toEqual([]);
    expect(writeWorkspaceUrlTargets(null,result.targets,T)).toBe(false);
    expect(readWorkspaceUrlTargets({getItem(){throw Error("blocked");}},T)).toEqual([]);
    expect(addWorkspaceUrlTargets([],"x".repeat(8193),T).rejected).toBe(1);
  });
});
