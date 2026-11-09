import { describe, expect, it } from "vitest";
import { discoverObservedExpressions, MAX_CONTEXT_CANDIDATES } from "./observedExpressionCandidates";
import { analyzeExpandedKeyword } from "./relatedKeywordAnalysis";
import type { Observation } from "./userKeywordTrend";

const rows: Observation[] = [
  { id:"a", videoId:"v1", videoTitle:"영상 1", channelId:"c1", channelName:"채널 1",
    publishedAt:"2026-11-08T10:00:00Z",text:"음악 노래 플레이리스트 노래" },
  { id:"b", videoId:"v1", videoTitle:"영상 1", channelId:"c1", channelName:"채널 1",
    publishedAt:"2026-11-09T09:00:00Z",text:"음악 노래 추천" },
  { id:"c", videoId:"v2", videoTitle:"영상 2", channelId:"c2", channelName:"채널 2",
    publishedAt:"2026-11-09T11:00:00Z",text:"노래 추천 음악팬" },
  { id:"d", videoId:"v2", videoTitle:"영상 2", channelId:"c2", channelName:"채널 2",
    publishedAt:"2026-11-09T12:00:00Z",text:"노래 감상" },
  { id:"old",videoId:"v2",videoTitle:"옛 영상",channelId:"c2",channelName:"채널 2",
    publishedAt:"2026-09-20T10:00:00Z",text:"음악 옛날노래" },
];

describe("G2-O observed expression candidates",()=>{
  it("derives candidate words ONLY from comments containing primary phrase in the current window",()=>{
    const r=discoverObservedExpressions("음악",rows,7);
    expect(r.kind).toBe("READY");
    if(r.kind!=="READY")return;
    expect(r.primaryComments).toBe(3);
    expect(r.sampleTotal).toBe(4);
    expect(r.candidates.find(x=>x.term==="노래")).toMatchObject({
      cooccurringComments:3,sampleMentions:4,
    });
    expect(r.candidates.find(x=>x.term==="플레이리스트")).toMatchObject({
      cooccurringComments:1,sampleMentions:1,
    });
    expect(r.candidates.some(x=>x.term==="옛날노래")).toBe(false);
    expect(r.candidates.some(x=>x.term==="음악팬")).toBe(false);
    expect(r.candidates.some(x=>x.term==="음악")).toBe(false);
    expect(r.candidates.length).toBeLessThanOrEqual(MAX_CONTEXT_CANDIDATES);
  });
  it("counts repeated tokens once per comment and retains source excerpts",()=>{
    const r=discoverObservedExpressions("음악",rows,7);
    if(r.kind!=="READY")throw Error("Expected READY");
    const chosen=r.candidates.find(x=>x.term==="노래");
    expect(chosen?.cooccurringComments).toBe(3);
    expect(chosen?.evidence).toHaveLength(2);
    expect(chosen?.evidence[0]).toEqual({
      commentId:"a",videoId:"v1",videoTitle:"영상 1",
      publishedAt:"2026-11-08T10:00:00Z",excerpt:"음악 노래 플레이리스트 노래",
    });
  });
  it("does not infer synonyms, new trend data, or choose a candidate automatically",()=>{
    const baseline=analyzeExpandedKeyword("음악",rows,7,[]);
    const r=discoverObservedExpressions("음악",rows,7);
    expect(r.kind).toBe("READY");
    if(baseline.kind!=="READY")throw Error("Baseline not ready");
    expect(baseline.selectedTerms).toEqual([]);
    expect(baseline.primaryCount).toBe(3);
    expect(baseline.relatedOnlyCount).toBe(0);
    // Only an explicit user selection can change the expanded union.
    const explicit=analyzeExpandedKeyword("음악",rows,7,["노래"]);
    if(explicit.kind==="READY")expect(explicit.combinedCount).toBe(4);
  });
  it("gracefully handles missing data, arbitrary keyword and zero matching comments",()=>{
    expect(discoverObservedExpressions(" ",rows,30)).toEqual({kind:"INVALID_KEYWORD"});
    expect(discoverObservedExpressions("음악",[],30)).toEqual({kind:"NO_DATA"});
    const unknown=discoverObservedExpressions("독일 와인",rows,30);
    expect(unknown.kind).toBe("READY");
    if(unknown.kind==="READY"){
      expect(unknown.primaryComments).toBe(0);
      expect(unknown.candidates).toEqual([]);
    }
  });
  it("scopes candidates to the active sample and observes Unicode normalization",()=>{
    const r=discoverObservedExpressions("음악",[
      ...rows,
      {id:"new",videoId:"v3",videoTitle:"영상 3",channelId:"c3",
       channelName:"채널 3",publishedAt:"2026-11-09T14:00:00Z",text:"음악 ＡＩ ３ 플레이리스트"},
    ],7);
    if(r.kind!=="READY")throw Error("Expected READY");
    expect(r.candidates.some(x=>x.term==="ai")).toBe(true);
    expect(r.candidates.some(x=>x.term==="３")).toBe(false);
  });
});
