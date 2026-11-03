import { describe, expect, it } from "vitest";
import {
  demoChannelSelection, demoChannelBSelection,
  getDemoChannelSelection,
} from "../data/demoChannelSelection";
import { demoAnalysisRepository } from "../data/DemoAnalysisRepository";
import { readDemoChannelAggregate } from "../data/readDemoChannelAggregate";
import { compareChannelAggregations } from "./channelComparison";
import type { ChannelAggregation } from "./channelAggregate";

async function ready(id: string) {
  const aggregate = await readDemoChannelAggregate(demoAnalysisRepository, id);
  if (aggregate.kind !== "READY") throw new Error("EXPECTED_READY_FIXTURE");
  return aggregate;
}

describe("YU-47 — explicitly registered synthetic channel A/B comparison", () => {
  it("registers two separate channels with no inferred real membership", () => {
    expect(getDemoChannelSelection(demoChannelSelection.channelId)?.videoIds)
      .toEqual(["Ab0_-123xyz", "Qb0_-123xyz"]);
    expect(getDemoChannelSelection(demoChannelBSelection.channelId)?.videoIds)
      .toEqual(["Cb0_-123xyz", "Db0_-123xyz"]);
    expect(getDemoChannelSelection("UC" + "Z".repeat(22))).toBeNull();
  });

  it("separately aggregates each channel with different classified denominators", async () => {
    const a = await ready(demoChannelSelection.channelId);
    const b = await ready(demoChannelBSelection.channelId);
    expect(a.sample).toEqual({raw:240, eligible:200, excluded:40,
      classified:160, unclassified:40});
    expect(b.sample).toEqual({raw:215, eligible:180, excluded:35,
      classified:140, unclassified:40});
    expect(b.sentiment).toMatchObject({positive:48,neutral:57,negative:35});
  });

  it("computes B − A percentage points without equating unequal sample sizes", async () => {
    const result = compareChannelAggregations(
      await ready(demoChannelSelection.channelId),
      await ready(demoChannelBSelection.channelId));
    expect(result.kind).toBe("READY");
    if (result.kind !== "READY") return;
    expect(result.left.sample.classified).toBe(160);
    expect(result.right.sample.classified).toBe(140);
    expect(result.sentiment.find(x=>x.label==="긍정")?.deltaPp)
      .toBeCloseTo(48/140*100 - 82/160*100);
    expect(result.topics.find(x=>x.topicId==="QUALITY"))
      .toEqual({topicId:"QUALITY",aMentions:0,bMentions:43,deltaCount:43});
    expect(result.topics.find(x=>x.topicId==="RECIPE")?.deltaCount).toBe(-31);
  });

  it("reversing channel order reverses topic and sentiment deltas", async () => {
    const b = await ready(demoChannelBSelection.channelId);
    const a = await ready(demoChannelSelection.channelId);
    const result = compareChannelAggregations(b, a);
    expect(result.kind).toBe("READY");
    if (result.kind !== "READY") return;
    expect(result.topics.find(x=>x.topicId==="QUALITY")?.deltaCount).toBe(-43);
    expect(result.sentiment.find(x=>x.label==="긍정")?.deltaPp).toBeGreaterThan(0);
  });

  it("same channel does not create a comparison", async () => {
    const a = await ready(demoChannelSelection.channelId);
    expect(compareChannelAggregations(a,a)).toEqual({
      kind:"BLOCKED", reason:"SAME_CHANNEL",
    });
  });

  it("unregistered channel does not borrow a registered aggregate", async () => {
    const a = await ready(demoChannelSelection.channelId);
    const forged = {...a, channelId:"UC"+"Z".repeat(22)};
    expect(compareChannelAggregations(a, forged)).toEqual({
      kind:"BLOCKED", reason:"UNREGISTERED_MANIFEST",
    });
  });

  it("rejects mismatched observation window and taxonomy", async () => {
    const a=await ready(demoChannelSelection.channelId);
    const b=await ready(demoChannelBSelection.channelId);
    expect(compareChannelAggregations(a,{
      ...b,observationWindow:{...b.observationWindow,locale:"en-US"},
    })).toEqual({kind:"BLOCKED",reason:"OBSERVATION_MISMATCH"});
    expect(compareChannelAggregations(a,{
      ...b,taxonomyVersion:"unverified-1",
    })).toEqual({kind:"BLOCKED",reason:"VERSION_MISMATCH"});
  });

  it("rejects missing/partial data without 0% synthetic stand-ins", async () => {
    const a=await ready(demoChannelSelection.channelId);
    const missing:ChannelAggregation = {kind:"BLOCKED",reason:"INCOMPLETE_OR_UNVERIFIED"};
    expect(compareChannelAggregations(a,missing)).toEqual({
      kind:"BLOCKED",reason:"NOT_READY",
    });
  });

  it("rejects forged totals and percent without leaking comparison values", async () => {
    const a=await ready(demoChannelSelection.channelId);
    const b=await ready(demoChannelBSelection.channelId);
    expect(compareChannelAggregations(a,{
      ...b,sentiment:{...b.sentiment,positivePercent:100},
    })).toEqual({kind:"BLOCKED",reason:"INVALID_COUNTS"});
    expect(compareChannelAggregations(a,{
      ...b,sample:{...b.sample,classified:999},
    })).toEqual({kind:"BLOCKED",reason:"INVALID_COUNTS"});
  });
});
