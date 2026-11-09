import {describe,expect,it} from "vitest";
import {importKeywordCsv,inspectKeyword,userKeyword} from "./userKeywordTrend";

const header="comment_id,video_id,channel_id,published_at,text,video_title,channel_name";
const sample=[
  header,
  'c1,v1,ch1,2026-11-01T08:00:00Z,"AI, 영상 이야기",첫 영상,첫 채널',
  'c2,v2,ch2,2026-11-02T08:00:00Z,다른 이야기,둘째 영상,다른 채널',
  'c3,v1,ch1,2026-11-03T08:00:00Z,AI 활용 관찰,첫 영상,첫 채널',
].join("\n");

describe("G2-K user-first local keyword model",()=>{
  it("parses CSV quoted commas and optional titles",()=>{
    const result=importKeywordCsv(sample);
    expect(result.kind).toBe("READY");
    if(result.kind==="READY"){
      expect(result.observations).toHaveLength(3);
      expect(result.observations[0].text).toBe("AI, 영상 이야기");
      expect(result.observations[0].videoTitle).toBe("첫 영상");
    }
  });
  it("refuses incomplete columns, duplicates, bad dates and broken quotes",()=>{
    expect(importKeywordCsv("keyword,total\na,1").kind).toBe("INVALID");
    expect(importKeywordCsv([header,sample.split("\n")[1],sample.split("\n")[1]].join("\n")).kind).toBe("INVALID");
    expect(importKeywordCsv([header,"c1,v1,ch1,invalid,time,v,c"].join("\n")).kind).toBe("INVALID");
    expect(importKeywordCsv([header,'c1,v1,ch1,2026-11-03T08:00:00Z,"unterminated'].join("\n")).kind).toBe("INVALID");
  });
  it("uses literal arbitrary user keyword, not a registered topic ID",()=>{
    expect(userKeyword("  독일 와인  ")).toBe("독일 와인");
    expect(userKeyword("AI  영상")).toBe("AI 영상");
    expect(userKeyword(" ")).toBeNull();
    expect(userKeyword("x".repeat(101))).toBeNull();
  });
  it("aggregates only the imported observation sample",()=>{
    const parsed=importKeywordCsv(sample);
    if(parsed.kind!=="READY")throw Error("Fixture error");
    const report=inspectKeyword("ai",parsed.observations,7);
    expect(report.kind).toBe("READY");
    if(report.kind==="READY"){
      expect(report.endDay).toBe("2026-11-03");
      expect(report.startDay).toBe("2026-10-28");
      expect(report.total).toBe(3);
      expect(report.matches).toBe(2);
      expect(report.videos).toEqual([{id:"v1",label:"첫 영상",count:2}]);
      expect(report.evidence).toHaveLength(2);
      expect(report.days.find(x=>x.day==="2026-10-28")).toEqual({
        day:"2026-10-28",observed:0,matched:0,
      });
    }
  });
  it("shows no fabricated data or positive trend for an unmatched query",()=>{
    const parsed=importKeywordCsv(sample);
    if(parsed.kind!=="READY")throw Error("Fixture error");
    const report=inspectKeyword("전혀 다른 용어",parsed.observations,30);
    expect(report.kind).toBe("READY");
    if(report.kind==="READY")expect(report.matches).toBe(0);
    expect(inspectKeyword("독일어",[],30)).toEqual({kind:"NO_DATA"});
  });
  it("treats HTML-like text as data and accepts UTC-offset observations",()=>{
    const parsed=importKeywordCsv([
      header,
      'c4,v1,ch1,2026-11-03T17:00:00+09:00,"<script>inert</script>",영상,채널',
    ].join("\n"));
    expect(parsed.kind).toBe("READY");
    if(parsed.kind==="READY"){
      const result=inspectKeyword("script",parsed.observations,7);
      expect(result.kind).toBe("READY");
      if(result.kind==="READY")expect(result.matches).toBe(1);
    }
  });
});
