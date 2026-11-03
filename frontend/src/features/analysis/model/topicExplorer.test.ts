import { describe, expect, it } from "vitest";
import { demoChannelSelection, demoChannelBSelection } from "../data/demoChannelSelection";
import { demoAnalysisRepository } from "../data/DemoAnalysisRepository";
import { readDemoChannelAggregate } from "../data/readDemoChannelAggregate";
import { exploreRegisteredTopic } from "./topicExplorer";

async function fixtures() {
  return Promise.all([
    readDemoChannelAggregate(demoAnalysisRepository,demoChannelSelection.channelId),
    readDemoChannelAggregate(demoAnalysisRepository,demoChannelBSelection.channelId),
  ]);
}
describe("YU-48 — synthetic topic contributions drilldown",()=>{
  it("returns selected videos' RECIPE counts, not fictional comment text", async()=>{
    const [a]=await fixtures();
    const result=exploreRegisteredTopic("RECIPE",[a]);
    expect(result.kind).toBe("READY");
    if (result.kind!=="READY") return;
    expect(result.channels[0].mentionCount).toBe(63);
    expect(result.channels[0].perVideo).toEqual([
      {videoId:"Ab0_-123xyz",mentionCount:38},
      {videoId:"Qb0_-123xyz",mentionCount:25},
    ]);
    expect(result.deltaCount).toBeNull();
  });
  it("compares QUALITY topic across verified channels only",async()=>{
    const [a,b]=await fixtures();
    const result=exploreRegisteredTopic("QUALITY",[a,b]);
    expect(result.kind).toBe("READY");
    if (result.kind!=="READY") return;
    expect(result.channels[0].mentionCount).toBe(0);
    expect(result.channels[1].mentionCount).toBe(43);
    expect(result.channels[1].perVideo.map(v=>v.mentionCount)).toEqual([18,25]);
    expect(result.deltaCount).toBe(43);
  });
  it("retains selected-video denominators without deriving per-topic sentiment",async()=>{
    const [a,b]=await fixtures();
    const result=exploreRegisteredTopic("PRICE",[a,b]);
    if (result.kind!=="READY") throw Error("NOT_READY");
    expect(result.channels.map(c=>c.sampleClassified)).toEqual([160,140]);
    expect(result.deltaCount).toBe(-7);
    expect("sentiment" in result.channels[0]).toBe(false);
  });
  it("unknown topic never becomes confirmed 0 count",async()=>{
    const [a,b]=await fixtures();
    expect(exploreRegisteredTopic("NEVER_SEEN",[a,b])).toEqual({
      kind:"BLOCKED",reason:"TOPIC_NOT_REGISTERED",
    });
  });
  it("rejects malformed IDs/URL-like topic strings",async()=>{
    const [a]=await fixtures();
    for(const id of ["=cmd","../../RECIPE","recipe","RECIPE\nINJECT",""]){
      expect(exploreRegisteredTopic(id,[a])).toEqual({
        kind:"BLOCKED",reason:"INVALID_TOPIC",
      });
    }
  });
  it("missing partial channel snapshot blocks all contributions",async()=>{
    const [a]=await fixtures();
    expect(exploreRegisteredTopic("PRICE",[a,{kind:"BLOCKED",reason:"INCOMPLETE_OR_UNVERIFIED"}]))
      .toEqual({kind:"BLOCKED",reason:"INCOMPLETE_OR_UNVERIFIED"});
  });
  it("does not combine incompatible observation scopes",async()=>{
    const [a,b]=await fixtures();
    if(b.kind!=="READY")throw Error("NOT_READY");
    expect(exploreRegisteredTopic("QUALITY",[a,{...b,
      observationWindow:{...b.observationWindow,windowEnd:"2026-10-09"}}]))
      .toEqual({kind:"BLOCKED",reason:"INCOMPATIBLE_CHANNELS"});
  });
  it("rejects empty or more than two channel groups",async()=>{
    const [a,b]=await fixtures();
    expect(exploreRegisteredTopic("RECIPE",[]).kind).toBe("BLOCKED");
    expect(exploreRegisteredTopic("RECIPE",[a,b,a]).kind).toBe("BLOCKED");
  });
});
