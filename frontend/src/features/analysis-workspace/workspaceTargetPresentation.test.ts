import {afterEach,describe,expect,it} from "vitest";
import {
  EMPTY_TARGET_PRESENTATION, WORKSPACE_TARGET_PRESENTATION_KEY,
  readTargetPresentation,reconcileTargetPresentation,writeTargetPresentation,
  withChannelArtwork,withUserLabel,userFacingTargetName,
} from "./workspaceTargetPresentation";
import {addWorkspaceUrlTargets,WORKSPACE_URL_TARGETS_TTL_MS,workspaceUrlTargetKey} from "./workspaceUrlTargets";
import {ApprovedChannelProfileCache} from "./workspaceChannelProfile";
const targets=addWorkspaceUrlTargets([],[
  "https://youtu.be/Ab0_-123xyz",
  "https://www.youtube.com/@somecreator",
].join("\n"),1000).targets;
const videoKey=workspaceUrlTargetKey(targets[0]);
const channelKey=workspaceUrlTargetKey(targets[1]);
const image="https://yt3.googleusercontent.com/some-channel-avatar";

afterEach(()=>sessionStorage.clear());

describe("UI-R04-N — only user-provided labels with trustworthy provenance",()=>{
  it("keeps original YouTube identities unchanged and labels as unverified overrides",()=>{
    const before=JSON.stringify(targets);
    const labelled=withUserLabel(EMPTY_TARGET_PRESENTATION,targets,videoKey,"  내가 붙인 제목  ");
    expect(userFacingTargetName(targets[0],labelled)).toBe("내가 붙인 제목");
    expect(userFacingTargetName(targets[0])).toBe("영상 제목 미확인");
    expect(userFacingTargetName(targets[1])).toBe("@somecreator");
    expect(JSON.stringify(targets)).toBe(before);
    const cleared=withUserLabel(labelled,targets,videoKey,"");
    expect(userFacingTargetName(targets[0],cleared)).toBe("영상 제목 미확인");
    expect(withUserLabel(labelled,targets,videoKey,"a".repeat(121))).toBe(labelled);
    expect(withUserLabel(labelled,targets,"VIDEO:not-registered","No")).toBe(labelled);
  });
  it("accepts only allowlisted channel image URLs; no automatic CDN request or identity claim",()=>{
    const named=withUserLabel(EMPTY_TARGET_PRESENTATION,targets,videoKey,"읽을 수 있는 제목");
    const updated=withChannelArtwork(named,targets,channelKey,image);
    expect(updated.channelImages[channelKey]).toBe(image);
    expect(withChannelArtwork(updated,targets,videoKey,image)).toBe(updated);
    expect(withChannelArtwork(updated,targets,channelKey,"https://evil.example/avatar"))
      .toBe(updated);
    expect(withChannelArtwork(updated,targets,channelKey,"http://yt3.googleusercontent.com/avatar"))
      .toBe(updated);
    expect(withChannelArtwork(updated,targets,channelKey,"https://yt3.googleusercontent.com.evil.example/avatar"))
      .toBe(updated);
    expect(withChannelArtwork(updated,targets,channelKey,"").channelImages[channelKey])
      .toBeUndefined();
    expect(reconcileTargetPresentation(updated,targets.slice(0,1)).channelImages)
      .toEqual({});
    const cache=new ApprovedChannelProfileCache();
    expect(cache.size).toBe(0);
  });
  it("stores validated tab-only bounded data within target TTL",()=>{
    const labelled=withUserLabel(EMPTY_TARGET_PRESENTATION,targets,videoKey,"메인 제목");
    const updated=withChannelArtwork(labelled,targets,channelKey,image);
    expect(writeTargetPresentation(sessionStorage,updated,targets,1000)).toBe(true);
    const raw=sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY);
    expect(raw).toContain('"version":1');
    expect(raw).not.toContain("youtu.be");
    expect(readTargetPresentation(sessionStorage,targets,1100)).toEqual(updated);
    expect(readTargetPresentation(sessionStorage,targets,
      1000+WORKSPACE_URL_TARGETS_TTL_MS+1)).toEqual(EMPTY_TARGET_PRESENTATION);
    expect(readTargetPresentation(sessionStorage,targets.slice(1),1100))
      .toEqual(EMPTY_TARGET_PRESENTATION);
    expect(writeTargetPresentation(sessionStorage,EMPTY_TARGET_PRESENTATION,targets,1100))
      .toBe(true);
    expect(sessionStorage.getItem(WORKSPACE_TARGET_PRESENTATION_KEY)).toBeNull();
  });
  it("rejects contaminated payloads, invalid images and blocked storage",()=>{
    for(const bad of [
      {version:1,savedAt:1000,labels:{[videoKey]:"title"},channelImages:{[channelKey]:"https://bad.example/x"}},
      {version:1,savedAt:1000,labels:{[videoKey]:"title"},channelImages:{},token:"secret"},
      {version:1,savedAt:1000,labels:{[videoKey]:"a".repeat(121)},channelImages:{}},
      {version:2,savedAt:1000,labels:{},channelImages:{}},
    ]) {
      sessionStorage.setItem(WORKSPACE_TARGET_PRESENTATION_KEY,JSON.stringify(bad));
      expect(readTargetPresentation(sessionStorage,targets,1100))
        .toEqual(EMPTY_TARGET_PRESENTATION);
    }
    const blocked={
      getItem(){throw Error("blocked");},
      setItem(){throw Error("blocked");},
      removeItem(){throw Error("blocked");},
    } as unknown as Storage;
    expect(readTargetPresentation(blocked,targets,1100)).toEqual(EMPTY_TARGET_PRESENTATION);
    expect(writeTargetPresentation(blocked,EMPTY_TARGET_PRESENTATION,targets,1100))
      .toBe(false);
  });
});
