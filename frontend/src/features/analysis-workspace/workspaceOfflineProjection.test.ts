import {describe,expect,it} from "vitest";
import {
  createR05OfflineProjection,R05_SYNTHETIC_CSV,
} from "./workspaceOfflineProjection";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";

const NOW="2026-11-09T16:00:00.000Z";
const csv=([
  "comment_id,video_id,channel_id,published_at,text,video_title,channel_name",
  "c1,AbCdefghI12,UCaaaaaaaaaaaaaaaaaaaaaa,2026-11-08T09:00:00Z,음악 노래 플레이리스트,사용자 영상 A,사용자 채널",
  "c2,AbCdefghI12,UCaaaaaaaaaaaaaaaaaaaaaa,2026-11-09T09:00:00Z,음악 노래,사용자 영상 A,사용자 채널",
  "c3,Qb0_-123xyz,UCbbbbbbbbbbbbbbbbbbbbbb,2026-11-09T11:00:00Z,노래 좋아요,사용자 영상 B,사용자 채널 B",
]).join("\n");
const build=(text:string,source:"USER_CSV_UNVERIFIED"|"SYNTHETIC_FIXTURE"=
  "USER_CSV_UNVERIFIED",keyword="음악")=>
  createR05OfflineProjection(text,keyword,7,source,NOW,"scope-test",[],[]);

describe("UI-R05-B2 offline GraphProjection projection from explicit data",()=>{
  it("constructs exact local CSV-based nodes/edges without fabricating provider search or channel membership",()=>{
    const r=build(csv);
    expect(r.kind).toBe("READY");
    if(r.kind!=="READY")return;
    expect(r.periodTotal).toBe(3);
    expect(r.primaryMatches).toBe(2);
    expect(r.sourceKind).toBe("USER_CSV_UNVERIFIED");
    expect(r.labels["VIDEO:AbCdefghI12"]).toBe("사용자 영상 A");
    expect(r.projection.nodes.filter(n=>n.kind==="KEYWORD")).toHaveLength(1);
    expect(r.projection.nodes.filter(n=>n.kind==="VIDEO")).toHaveLength(2);
    expect(r.projection.nodes.filter(n=>n.kind==="EVIDENCE_SET")).toHaveLength(2);
    const edges=r.projection.edges;
    expect(edges.filter(e=>e.kind==="VIDEO_HAS_SAMPLE")).toHaveLength(2);
    expect(edges.filter(e=>e.kind==="RETURNED_BY_SEARCH")).toHaveLength(0);
    expect(edges.filter(e=>e.kind==="CHANNEL_PUBLISHES_VIDEO")).toHaveLength(0);
    expect(r.projection.nodes.find(n=>n.kind==="EXPRESSION"&&n.label==="노래"))
      .toMatchObject({observedCount:2,provenance:{kind:"USER_CSV_UNVERIFIED"}});
    expect(edges.find(e=>e.kind==="LEXICAL_COOCCURRENCE"&&e.count===2)
      ?.evidenceCommentIds).toEqual(["c1","c2"]);
  });

  it("keeps synthetic fixture explicitly separate from an official API source",()=>{
    const r=build(R05_SYNTHETIC_CSV,"SYNTHETIC_FIXTURE");
    expect(r.kind).toBe("READY");
    if(r.kind!=="READY")return;
    expect(r.labels["VIDEO:AbCdefghI12"]).toBe("합성 영상 A");
    expect(r.projection.nodes.some(n=>n.provenance.kind===
      "YOUTUBE_API_FIRST_PAGE_PUBLIC")).toBe(false);
    expect(r.projection.nodes.some(n=>n.kind==="EXPRESSION")).toBe(true);
    expect(r.projection.nodes.some(n=>n.kind==="EVIDENCE_SET")).toBe(true);
  });

  it("does not touch R04 URL registration or infer verified channel relations from local CSV",()=>{
    const targets=addWorkspaceUrlTargets([],
      "https://youtu.be/AbCdefghI12",1000).targets;
    const before=JSON.stringify(targets);
    const projection=createR05OfflineProjection(csv,"음악",7,
      "USER_CSV_UNVERIFIED",NOW,"one",targets,[]);
    expect(JSON.stringify(targets)).toBe(before);
    if(projection.kind!=="READY")throw Error("READY required");
    expect(projection.projection.nodes.filter(n=>n.key==="VIDEO:AbCdefghI12"))
      .toHaveLength(1);
    expect(projection.projection.nodes.find(n=>n.key==="VIDEO:AbCdefghI12")
      ?.kind).toBe("VIDEO");
    expect(projection.projection.edges.some(e=>e.kind==="CHANNEL_PUBLISHES_VIDEO"))
      .toBe(false);
  });

  it("rejects malformed CSV, oversized source and more than 3 distinct videos",()=>{
    expect(build("not a valid CSV").kind).toBe("INVALID");
    expect(build("x".repeat(2*1024*1024+1)).kind).toBe("INVALID");
    const many=[...csv.split("\n"),
      "c4,Zb0_-123xyz,ch3,2026-11-09T12:00:00Z,음악,영상 C,채널 C",
      "c5,Yb0_-123xyz,ch4,2026-11-09T13:00:00Z,음악,영상 D,채널 D",
    ].join("\n");
    expect(build(many)).toMatchObject({kind:"INVALID"});
    expect(build(csv.replace("AbCdefghI12","bad-id")).kind).toBe("INVALID");
    expect(createR05OfflineProjection(csv,"음악",7,
      "USER_CSV_UNVERIFIED","invalid-time","scope-test",[],[]).kind)
      .toBe("INVALID");
  });

  it("preserves zero matching primary phrase and shows no invented expression links",()=>{
    const r=build(csv,"USER_CSV_UNVERIFIED","사용자가 선택한 임의의 키워드");
    if(r.kind!=="READY")throw Error("READY required");
    expect(r.primaryMatches).toBe(0);
    expect(r.projection.nodes.filter(n=>n.kind==="EXPRESSION")).toHaveLength(0);
    expect(r.projection.edges.filter(e=>e.kind==="LEXICAL_COOCCURRENCE"))
      .toHaveLength(0);
  });

  it("does not mutate records or compute time using the global clock",()=>{
    const r=build(csv);
    const other=build(csv);
    expect(r).toEqual(other);
    if(r.kind==="READY"){
      expect(r.observations).toHaveLength(3);
      expect(r.projection.edges.every(e=>e.provenance.kind!=="YOUTUBE_API_SEARCH"))
        .toBe(true);
    }
  });
});
