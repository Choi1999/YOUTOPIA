import { describe, expect, it } from "vitest";
import {
  R05_GRAPH_PROJECTION_SCHEMA,
  R05_MAX_EXPRESSIONS,
  R05_MAX_SAMPLE_SNAPSHOTS,
  R05_MAX_SEARCH_VIDEOS,
  buildR05GraphProjection,
  type R05GraphProjectionInput,
  type R05ObservationScope,
  type R05SearchResult,
  type R05VideoSample,
} from "./workspaceGraphProjection";
import {
  addWorkspaceUrlTargets,
  workspaceUrlTargetKey,
  WORKSPACE_MAX_URL_TARGETS,
} from "./workspaceUrlTargets";
import type { WorkspaceNodeGroup } from "./workspaceNodeGroups";

const videoId = "AbCdefghI12";
const otherVideo = "Qb0_-123xyz";
const channelId = "UC" + "a".repeat(22);
const otherChannel = "UC" + "b".repeat(22);
const time = "2026-11-09T10:00:00Z";
const source = "USER_CSV_UNVERIFIED" as const;
const scope: R05ObservationScope = {
  id: "scope-01",
  keyword: "음악",
  sourceKind: source,
  status: "READY",
  startDay: "2026-11-03",
  endDay: "2026-11-09",
  periodTotal: 4,
};
const search: R05SearchResult = {
  source: "YOUTUBE_API_SEARCH",
  keyword: "음악",
  fetchedAt: time,
  videos: [
    { videoId, channelId, videoTitle: "공식 검색 후보 영상", channelTitle: "공식 채널" },
    { videoId: otherVideo, channelId: null, videoTitle: "두 번째 영상", channelTitle: null },
  ],
};
const sample: R05VideoSample = {
  snapshotId: "sample-01",
  sourceKind: source,
  videoId,
  status: "READY",
  fetchedAt: time,
  fetchedCount: 4,
  periodCount: 4,
};
const terms = [
  { term: "노래", sourceKind: source, cooccurringComments: 2,
    evidenceCommentIds: ["comment-1", "comment-2"] },
  { term: "플레이리스트", sourceKind: source, cooccurringComments: 1,
    evidenceCommentIds: ["comment-1"] },
];
const urls = addWorkspaceUrlTargets([], [
  "https://www.youtube.com/watch?v=" + videoId,
  "https://www.youtube.com/channel/" + channelId,
  "https://www.youtube.com/@confirmedhandle",
].join(" "), 1000).targets;
const group: WorkspaceNodeGroup = {
  id: "group-1", name: "내 작업 그룹", color: "blue",
  memberKeys: [workspaceUrlTargetKey(urls[0]), workspaceUrlTargetKey(urls[1])],
  collapsed: false, offsetX: 0, offsetY: 0,
};
const input = (overrides: Partial<R05GraphProjectionInput> = {}): R05GraphProjectionInput => ({
  registeredTargets: urls,
  groups: [group],
  scope,
  search,
  samples: [sample],
  expressions: terms,
  ...overrides,
});

describe("R05-B1 graph-first data projection without runtime or network effects", () => {
  it("preserves R04 canonical VIDEO/CHANNEL/HANDLE target identities and explicit user groups", () => {
    const graph = buildR05GraphProjection(input());
    expect(graph.schema).toBe(R05_GRAPH_PROJECTION_SCHEMA);
    const video = graph.nodes.find(x => x.key === "VIDEO:" + videoId);
    const channel = graph.nodes.find(x => x.key === "CHANNEL:" + channelId);
    const unresolved = graph.nodes.find(x => x.key === "CHANNEL_HANDLE:@confirmedhandle");
    expect(video).toMatchObject({
      kind: "VIDEO", label: "공식 검색 후보 영상", status: "SEARCH_CANDIDATE",
    });
    expect(channel?.kind).toBe("CHANNEL");
    expect(unresolved?.kind).toBe("CHANNEL_HANDLE_CANDIDATE");
    expect(unresolved?.status).toBe("UNVERIFIED");
    expect(graph.nodes.filter(x => x.key === "VIDEO:" + videoId)).toHaveLength(1);
    expect(graph.edges.filter(x => x.kind === "USER_GROUP_MEMBERSHIP"))
      .toHaveLength(2);
    expect(graph.nodes.find(x => x.kind === "GROUP")).toMatchObject({
      label: "내 작업 그룹", status: "USER_SELECTED",
    });
    expect(graph.edges.filter(x => x.kind === "CHANNEL_PUBLISHES_VIDEO"))
      .toHaveLength(1);
    expect(graph.edges.some(x => x.source === unresolved?.key &&
      x.kind === "CHANNEL_PUBLISHES_VIDEO")).toBe(false);
  });

  it("distinguishes search return / official channel membership / sample / lexical cooccurrence", () => {
    const graph = buildR05GraphProjection(input());
    const returned = graph.edges.filter(x => x.kind === "RETURNED_BY_SEARCH");
    expect(returned).toHaveLength(2);
    expect(returned.every(x => x.count === null &&
      x.provenance.kind === "YOUTUBE_API_SEARCH")).toBe(true);
    const ownership = graph.edges.filter(x => x.kind === "CHANNEL_PUBLISHES_VIDEO");
    expect(ownership).toHaveLength(1);
    expect(ownership[0].source).toBe("CHANNEL:" + channelId);
    expect(ownership[0].target).toBe("VIDEO:" + videoId);
    const samples = graph.edges.filter(x => x.kind === "VIDEO_HAS_SAMPLE");
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({count:4,provenance:{
      kind:"USER_CSV_UNVERIFIED",scopeId:"scope-01",snapshotId:"sample-01",
    }});
    const mentions = graph.edges.filter(x => x.kind === "LEXICAL_COOCCURRENCE");
    expect(mentions.map(x=>x.count).sort()).toEqual([1,2]);
    expect(mentions.every(x=>x.provenance.kind==="USER_CSV_UNVERIFIED")).toBe(true);
    expect(mentions.find(x=>x.count===2)?.evidenceCommentIds)
      .toEqual(["comment-1","comment-2"]);
    expect(returned.every(x=>x.evidenceCommentIds===null)).toBe(true);
    expect(graph.nodes.filter(x=>x.kind==="EXPRESSION")).toHaveLength(2);
    expect(graph.nodes.find(x=>x.kind==="EVIDENCE_SET")?.observedCount).toBe(4);
  });

  it("does not infer channel/video ownership from an unverified URL, title or @handle",()=>{
    const graph=buildR05GraphProjection(input({scope:null,search:null,samples:[],expressions:[]}));
    expect(graph.nodes.map(n=>n.kind)).toEqual([
      "VIDEO","CHANNEL","CHANNEL_HANDLE_CANDIDATE","GROUP",
    ]);
    expect(graph.edges.every(e=>e.kind==="USER_GROUP_MEMBERSHIP")).toBe(true);
    expect(graph.nodes.find(n=>n.kind==="CHANNEL")?.status).toBe("UNVERIFIED");
    expect(graph.nodes.some(n=>n.kind==="KEYWORD")).toBe(false);
  });

  it("does not treat NO_DATA / POLICY_BLOCKED / FAILED / STALE as zero observations",()=>{
    for (const status of ["NO_DATA","POLICY_BLOCKED","FAILED","STALE"] as const) {
      const graph=buildR05GraphProjection(input({
        scope:{...scope,status},
        samples:[{...sample,status:"READY"}],
      }));
      const evidence=graph.nodes.find(n=>n.kind==="EVIDENCE_SET");
      expect(evidence?.observedCount).toBeNull();
      expect(evidence?.status).toBe(status);
      expect(graph.edges.some(x=>x.kind==="VIDEO_HAS_SAMPLE")).toBe(false);
      expect(graph.edges.some(x=>x.kind==="LEXICAL_COOCCURRENCE")).toBe(false);
      expect(graph.nodes.some(x=>x.kind==="EXPRESSION")).toBe(false);
      // A separately sourced search result may remain visible.
      expect(graph.edges.filter(x=>x.kind==="RETURNED_BY_SEARCH")).toHaveLength(2);
    }
  });

  it("permits a known, explicitly observed zero only when READY and bounded",()=>{
    const graph=buildR05GraphProjection(input({
      scope:{...scope,periodTotal:0},
      samples:[{...sample,fetchedCount:0,periodCount:0}],
      expressions:[],
    }));
    expect(graph.nodes.find(n=>n.kind==="EVIDENCE_SET")?.observedCount).toBe(0);
    expect(graph.edges.find(e=>e.kind==="VIDEO_HAS_SAMPLE")?.count).toBe(0);
    expect(graph.edges.some(e=>e.kind==="LEXICAL_COOCCURRENCE")).toBe(false);
  });

  it("rejects untrusted/foreign sample source, bad dates and fabricated positive expression",()=>{
    const graph=buildR05GraphProjection(input({
      samples:[
        {...sample,sourceKind:"YOUTUBE_API_FIRST_PAGE_PUBLIC"},
        {...sample,snapshotId:"invalid",videoId:"invalid"},
        {...sample,snapshotId:"over-window",videoId:otherVideo,
          fetchedCount:5,periodCount:5},
      ],
      expressions:[
        {...terms[0],sourceKind:"SYNTHETIC_FIXTURE"},
        {...terms[0],cooccurringComments:5},
        {...terms[0],evidenceCommentIds:[]},
        {...terms[1],cooccurringComments:0},
      ],
    }));
    expect(graph.rejected.snapshots).toBe(3);
    expect(graph.rejected.expressions).toBe(4);
    expect(graph.edges.some(e=>e.kind==="VIDEO_HAS_SAMPLE")).toBe(false);
    expect(graph.edges.some(e=>e.kind==="LEXICAL_COOCCURRENCE")).toBe(false);

    const expired=buildR05GraphProjection(input({
      scope:{...scope,startDay:"2026-11-32"},
    }));
    expect(expired.rejected.scope).toBe(1);
    expect(expired.nodes.some(n=>n.kind==="KEYWORD")).toBe(false);
  });

  it("scopes expression IDs to the local observation scope, not video or group IDs",()=>{
    const one=buildR05GraphProjection(input({
      scope:{...scope,id:"sample-a"},
      search:null, samples:[],
    }));
    const two=buildR05GraphProjection(input({
      scope:{...scope,id:"sample-b"},
      search:null, samples:[],
    }));
    const first=one.nodes.find(n=>n.kind==="EXPRESSION")?.key;
    const second=two.nodes.find(n=>n.kind==="EXPRESSION")?.key;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
    expect(first?.startsWith("EXPRESSION:")).toBe(true);
    expect(one.nodes.find(n=>n.kind==="KEYWORD")?.key).not.toBe(
      two.nodes.find(n=>n.kind==="KEYWORD")?.key);
  });

  it("rejects duplicate terms and repeated search candidates without double counting",()=>{
    const graph=buildR05GraphProjection(input({
      search:{...search,videos:[...search.videos,search.videos[0]]},
      expressions:[terms[0],{...terms[0],term:" 노래 "},{...terms[0],term:"음악"}],
    }));
    expect(graph.rejected.search).toBe(1);
    expect(graph.rejected.expressions).toBe(2);
    expect(graph.edges.filter(e=>e.kind==="RETURNED_BY_SEARCH")).toHaveLength(2);
    expect(graph.edges.filter(e=>e.kind==="LEXICAL_COOCCURRENCE")).toHaveLength(1);
  });

  it("does not accept incorrect search term, forged provider kind or unsupported host",()=>{
    const badTarget={...urls[0],canonicalUrl:"https://evil.youtube.com/watch?v="+videoId};
    const graph=buildR05GraphProjection(input({
      registeredTargets:[badTarget],
      groups:[],
      search:{...search,keyword:"다른 검색"},
    }));
    expect(graph.rejected.targets).toBe(1);
    expect(graph.rejected.search).toBe(2);
    expect(graph.edges.some(e=>e.kind==="RETURNED_BY_SEARCH")).toBe(false);
    expect(graph.nodes.some(n=>n.kind==="VIDEO")).toBe(true); // explicit sample only
    expect(graph.nodes.find(n=>n.kind==="VIDEO")?.status).toBe("UNVERIFIED");
  });

  it("allows only verified-shape UTC timestamps and keeps unknown metadata unknown",()=>{
    const graph=buildR05GraphProjection(input({
      registeredTargets:[],
      groups:[],
      search:{...search,fetchedAt:"2026-11-09T35:00:00Z"},
      samples:[{...sample,fetchedAt:"2026-11-09T10:00:00+09:00"}],
      expressions:[],
    }));
    expect(graph.rejected.search).toBe(2);
    expect(graph.rejected.snapshots).toBe(1);
    expect(graph.nodes.filter(n=>n.kind==="VIDEO")).toHaveLength(0);
    const other=buildR05GraphProjection(input({
      registeredTargets:[],groups:[],
      search:{...search,videos:[{videoId,channelId:null,videoTitle:null,channelTitle:null}]},
      samples:[],expressions:[],
    }));
    expect(other.nodes.find(n=>n.kind==="VIDEO")?.label).toBe("영상 제목 미확인");
    expect(other.edges.some(x=>x.kind==="CHANNEL_PUBLISHES_VIDEO")).toBe(false);
  });

  it("fails closed on explicit search/sample/expression safety budgets",()=>{
    const many=Array.from({length:R05_MAX_SEARCH_VIDEOS+1},(_,i)=>({
      videoId:"AbCdefgh"+String(i).padStart(3,"0"),
      channelId:null,videoTitle:null,channelTitle:null,
    }));
    const over=buildR05GraphProjection(input({
      search:{...search,videos:many},
      samples:Array.from({length:R05_MAX_SAMPLE_SNAPSHOTS+1},(_,i)=>({
        ...sample, snapshotId:"sample-"+i,
        videoId:i===0?videoId:otherVideo,
      })),
      expressions:Array.from({length:R05_MAX_EXPRESSIONS+1},(_,i)=>({
        term:"후보"+i,sourceKind:source,cooccurringComments:1,
        evidenceCommentIds:["comment-"+i],
      })),
    }));
    expect(over.rejected.search).toBe(R05_MAX_SEARCH_VIDEOS+1);
    expect(over.rejected.snapshots).toBeGreaterThanOrEqual(2);
    expect(over.rejected.expressions).toBe(1);
    expect(over.edges.filter(e=>e.kind==="RETURNED_BY_SEARCH")).toHaveLength(0);
    expect(over.nodes.filter(e=>e.kind==="EXPRESSION")).toHaveLength(R05_MAX_EXPRESSIONS);
  });

  it("does not mutate inputs, persist anything, read time or issue network calls",()=>{
    const frozen: R05GraphProjectionInput = Object.freeze({
      registeredTargets:Object.freeze([...urls]),
      groups:Object.freeze([group]),
      scope:Object.freeze({...scope}),
      search:Object.freeze({...search,videos:Object.freeze([...search.videos])}),
      samples:Object.freeze([{...sample}]),
      expressions:Object.freeze([...terms]),
    });
    const before=JSON.stringify(frozen);
    const first=buildR05GraphProjection(frozen);
    const second=buildR05GraphProjection(frozen);
    expect(first).toEqual(second);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(first.nodes.every(node=>!Object.prototype.hasOwnProperty.call(node,"text")))
      .toBe(true);
    expect(first.nodes.every(node=>!Object.prototype.hasOwnProperty.call(node,"token")))
      .toBe(true);
  });

  it("enforces existing registered URL capacity and group membership ownership",()=>{
    const extra = Array.from({length:WORKSPACE_MAX_URL_TARGETS+1},(_,i)=>({
      ...urls[0],id:"AbCdefgh"+String(i).padStart(3,"0"),
      canonicalUrl:"https://www.youtube.com/watch?v=" +
        "AbCdefgh"+String(i).padStart(3,"0"),
    }));
    const first=buildR05GraphProjection(input({
      registeredTargets:extra,groups:[],scope:null,search:null,samples:[],expressions:[],
    }));
    expect(first.nodes).toHaveLength(WORKSPACE_MAX_URL_TARGETS);
    expect(first.rejected.targets).toBe(1);
    const groupConflict=buildR05GraphProjection(input({
      groups:[group,{...group,id:"group-2",name:"다른 그룹"}],
    }));
    expect(groupConflict.rejected.groups).toBe(1);
    expect(groupConflict.edges.filter(e=>e.kind==="USER_GROUP_MEMBERSHIP")).toHaveLength(2);
  });
});
