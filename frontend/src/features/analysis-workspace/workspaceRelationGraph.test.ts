import { describe, expect, it } from "vitest";
import type { AnalysisRepository } from "../analysis/data/AnalysisRepository";
import { demoAnalysisRepository } from "../analysis/data/DemoAnalysisRepository";
import { demoChannelSelections } from "../analysis/data/demoChannelSelection";
import { readWorkspaceCatalog } from "./analysisWorkspaceCatalog";
import {
  createDefaultWorkspaceSession, withWorkspacePair, withWorkspaceTopic,
} from "./analysisWorkspaceSession";
import { buildWorkspaceRelationGraph, relationNodeKey } from "./workspaceRelationGraph";

const A = demoChannelSelections[0].channelId;
const B = demoChannelSelections[1].channelId;

describe("UI-R04-A — validated synthetic relation graph", () => {
  it("renders only registered channel selections and curated synthetic edges", async () => {
    const graph = buildWorkspaceRelationGraph(
      createDefaultWorkspaceSession(),
      await readWorkspaceCatalog(demoAnalysisRepository),
    );
    expect(graph.nodes.filter(n => n.kind === "CHANNEL")).toHaveLength(2);
    expect(graph.nodes.filter(n => n.kind === "VIDEO")).toHaveLength(4);
    expect(graph.nodes.filter(n => n.kind === "TOPIC")).toHaveLength(1);
    expect(graph.edges.filter(e => e.type === "CURATED_SET")).toHaveLength(4);
    const edges = graph.edges.filter(e => e.type === "VERIFIED_TOPIC_MENTION");
    expect(edges).toHaveLength(4);
    expect(edges.map(e => e.count).sort((a,b) => Number(a)-Number(b)))
      .toEqual([12,20,25,38]);
    expect(graph.nodes[0].id).toBe(A);
    expect(graph.nodes.some(n => n.kind === "CHANNEL" && n.id === B)).toBe(true);
    expect(graph.edges.find(e => e.source === relationNodeKey("CHANNEL", A)
      && e.target === relationNodeKey("VIDEO", "Ab0_-123xyz"))?.count).toBeNull();
  });

  it("preserves a partial selection and never invents a channel B", async () => {
    const session = withWorkspacePair(
      createDefaultWorkspaceSession(), "channelIds", 1, "",
    )!;
    const graph = buildWorkspaceRelationGraph(session,
      await readWorkspaceCatalog(demoAnalysisRepository));
    expect(graph.nodes.filter(n => n.kind === "CHANNEL")).toHaveLength(1);
    expect(graph.nodes.filter(n => n.kind === "VIDEO")).toHaveLength(2);
    expect(graph.edges.filter(e => e.type === "CURATED_SET")).toHaveLength(2);
  });

  it("does not infer a topic link from blocked or missing video evidence", async () => {
    const repo: AnalysisRepository = {
      async getSnapshot(target) {
        return target.targetId === "Qb0_-123xyz"
          ? {kind:"NOT_FOUND"}
          : demoAnalysisRepository.getSnapshot(target);
      },
    };
    const graph = buildWorkspaceRelationGraph(createDefaultWorkspaceSession(),
      await readWorkspaceCatalog(repo));
    expect(graph.nodes.find(n => n.id === "Qb0_-123xyz")?.status).toBe("BLOCKED");
    expect(graph.edges.some(e => e.type === "VERIFIED_TOPIC_MENTION" &&
      e.source === relationNodeKey("VIDEO","Qb0_-123xyz"))).toBe(false);
    expect(graph.nodes.find(n => n.id === A)?.status).toBe("BLOCKED");
    expect(graph.edges.filter(e=>e.type==="CURATED_SET")).toHaveLength(4);
  });

  it("does not call an unselected topic data '0' and never invents unknown IDs", async () => {
    const entries = await readWorkspaceCatalog(demoAnalysisRepository);
    const session = withWorkspaceTopic(createDefaultWorkspaceSession(),"QUALITY")!;
    const graph = buildWorkspaceRelationGraph(session,entries);
    const topicEdges = graph.edges.filter(e => e.type === "VERIFIED_TOPIC_MENTION");
    expect(topicEdges).toHaveLength(2);
    expect(topicEdges.map(e => e.count).sort((a,b)=>Number(a)-Number(b)))
      .toEqual([18,25]);
    const unsafe = {
      ...session, topicId:"INVALID", channelIds:["UC"+"Z".repeat(22),""] as [string,string],
    };
    const rejected = buildWorkspaceRelationGraph(unsafe,entries);
    expect(rejected.nodes).toHaveLength(0);
    expect(rejected.edges).toHaveLength(0);
  });

  it("clears all topic links when no topic is selected", async () => {
    const graph = buildWorkspaceRelationGraph(
      withWorkspaceTopic(createDefaultWorkspaceSession(),"")!,
      await readWorkspaceCatalog(demoAnalysisRepository),
    );
    expect(graph.topicId).toBeNull();
    expect(graph.nodes.some(n=>n.kind==="TOPIC")).toBe(false);
    expect(graph.edges.every(e=>e.type==="CURATED_SET")).toBe(true);
  });
});
