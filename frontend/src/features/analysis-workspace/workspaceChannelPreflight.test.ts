import {describe,expect,it} from "vitest";
import {
  addWorkspaceUrlTargets,
  WORKSPACE_MAX_URL_BATCH,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import {
  CHANNEL_PREFLIGHT_GATE, CHANNEL_PREFLIGHT_REVIEW_BUDGET,
  planOfflineChannelMetadata, simulateChannelListResponse,
  classifyChannelApiFailure,
} from "./workspaceChannelPreflight";

const ID="UC"+"A".repeat(22);
const OTHER="UC"+"B".repeat(22);
function registered(...raws:string[]): readonly WorkspaceUrlTarget[] {
  // Match the existing intake contract: at most 32 URLs in a single batch.
  // The preflight covers the complete per-tab collection assembled over time.
  let current: readonly WorkspaceUrlTarget[] = [];
  for(let start=0;start<raws.length;start+=WORKSPACE_MAX_URL_BATCH) {
    current=addWorkspaceUrlTargets(
      current,raws.slice(start,start+WORKSPACE_MAX_URL_BATCH).join("\n"),1_000,
    ).targets;
  }
  return current;
}
function idUrl(id:string) {
  return "https://www.youtube.com/channel/"+id;
}
const when=2_000;
function response(id:string,title="Verified source fixture") {
  return {
    kind:"youtube#channelListResponse",
    etag:"opaque-etag-not-retained",
    items:[{
      kind:"youtube#channel",
      id,
      snippet:{
        title,
        customUrl:"@something-unrelated",
        thumbnails:{
          high:{url:"https://yt3.ggpht.com/a-/valid-img"},
        },
      },
    }],
  };
}

describe("UI-R04-G — offline channel metadata preflight",()=>{
  it("keeps POLICY_HOLD and emits only id/forHandle dry-run descriptors",()=>{
    const plan=planOfflineChannelMetadata(registered(
      idUrl(ID),"https://youtube.com/@ExampleCreator",
      "https://youtu.be/Ab0_-123xyz",
    ));
    expect(CHANNEL_PREFLIGHT_GATE).toBe("POLICY_HOLD");
    expect(plan).toMatchObject({
      mode:"OFFLINE_PLAN_ONLY",policyGate:"POLICY_HOLD",
      channelTargets:2,ignoredVideos:1,duplicates:0,
      estimatedUnits:2,reviewBudget:CHANNEL_PREFLIGHT_REVIEW_BUDGET,
      budgetStatus:"WITHIN_LIMIT",liveRequestAuthorized:false,
      networkExecuted:false,
    });
    expect(plan.operations).toEqual([
      {method:"GET",resource:"channels.list",part:"snippet",
        filter:"id",values:[ID],maxResults:1,estimatedUnits:1},
      {method:"GET",resource:"channels.list",part:"snippet",
        filter:"forHandle",values:["@examplecreator"],maxResults:1,estimatedUnits:1},
    ]);
    expect(JSON.stringify(plan)).not.toMatch(/apiKey|authorization|secret|fetch/i);
  });

  it("batches at most 50 distinct channel IDs, never co-mingles handles",()=>{
    const ids=Array.from({length:51},(_,i)=>
      "UC"+String(i).padStart(22,"0"));
    const input=registered(...ids.map(idUrl),
      "https://youtube.com/@firstchannel","https://youtube.com/@secondchannel");
    const plan=planOfflineChannelMetadata(input,5);
    expect(plan.channelTargets).toBe(53);
    expect(plan.operations).toHaveLength(4);
    expect(plan.operations[0].filter).toBe("id");
    expect(plan.operations[0].values).toHaveLength(50);
    expect(plan.operations[1].values).toHaveLength(1);
    expect(plan.operations[2].filter).toBe("forHandle");
    expect(plan.estimatedUnits).toBe(4);
    expect(plan.budgetStatus).toBe("WITHIN_LIMIT");
  });

  it("flags quota budget, invalid identity and oversized registrations before any dispatch",()=>{
    const urls=Array.from({length:11},(_,i)=>
      "https://youtube.com/@creator"+String(i).padStart(3,"0"));
    const plan=planOfflineChannelMetadata(registered(...urls),10);
    expect(plan.budgetStatus).toBe("BUDGET_EXCEEDED");
    expect(plan.estimatedUnits).toBe(11);
    expect(plan.networkExecuted).toBe(false);
    expect(planOfflineChannelMetadata(registered(idUrl(ID)),-1).budgetStatus)
      .toBe("INVALID_INPUT");
    const fake={kind:"CHANNEL" as const,id:ID,
      canonicalUrl:"https://youtube.com.evil.test/channel/"+ID};
    expect(planOfflineChannelMetadata([fake]).budgetStatus).toBe("INVALID_INPUT");
    expect(planOfflineChannelMetadata(
      Array.from({length:129},()=>registered(idUrl(ID))[0])
    ).budgetStatus).toBe("INVALID_INPUT");
  });

  it("deduplicates the request workload and ignores VIDEO targets",()=>{
    const entries=registered(idUrl(ID));
    const plan=planOfflineChannelMetadata([...entries,...entries],2);
    expect(plan.duplicates).toBe(1);
    expect(plan.estimatedUnits).toBe(1);
  });

  it("accepts only exact returned IDs for offline id-batch fixtures",()=>{
    const op=planOfflineChannelMetadata(registered(idUrl(ID),idUrl(OTHER))).operations[0];
    const accepted=simulateChannelListResponse(op,response(ID),when);
    expect(accepted.kind).toBe("ACCEPTED_SIMULATION");
    if(accepted.kind==="ACCEPTED_SIMULATION") {
      expect(accepted.notFound).toEqual([OTHER]);
      expect(accepted.profiles[0]).toMatchObject({
        source:"APPROVED_CHANNEL_SNIPPET",channelId:ID,
        handle:null,title:"Verified source fixture",
        thumbnailUrl:"https://yt3.ggpht.com/a-/valid-img",
      });
    }
    const unrelated="UC"+"C".repeat(22);
    expect(simulateChannelListResponse(op,response(unrelated),when))
      .toMatchObject({kind:"REJECTED_SIMULATION",reason:"IDENTITY_MISMATCH"});
    const dupe=response(ID);
    expect(simulateChannelListResponse(op,{...dupe,items:[...dupe.items,...dupe.items]},when))
      .toMatchObject({kind:"REJECTED_SIMULATION",reason:"MALFORMED_RESPONSE"});
  });

  it("associates a forHandle query response only with the queried handle",()=>{
    const op=planOfflineChannelMetadata(registered(
      "https://www.youtube.com/@ExampleCreator",
    )).operations[0];
    const result=simulateChannelListResponse(op,response(ID),when);
    expect(result.kind).toBe("ACCEPTED_SIMULATION");
    if(result.kind==="ACCEPTED_SIMULATION")
      expect(result.profiles[0].handle).toBe("@examplecreator");
    expect(simulateChannelListResponse(op,{
      kind:"youtube#channelListResponse",items:[],
    },when)).toMatchObject({
      kind:"ACCEPTED_SIMULATION",notFound:["@examplecreator"],
    });
  });

  it("does not trust unapproved image origins or arbitrary API response fields",()=>{
    const op=planOfflineChannelMetadata(registered(idUrl(ID))).operations[0];
    const unapproved=response(ID);
    unapproved.items[0].snippet.thumbnails.high.url=
      "https://yt3.ggpht.com.attacker.example/redirect";
    const accepted=simulateChannelListResponse(op,unapproved,when);
    expect(accepted.kind).toBe("ACCEPTED_SIMULATION");
    if(accepted.kind==="ACCEPTED_SIMULATION")
      expect(accepted.profiles[0].thumbnailUrl).toBeNull();
    expect(simulateChannelListResponse(op,{kind:"not-a-channel-list",items:[]},when))
      .toMatchObject({kind:"REJECTED_SIMULATION"});
    expect(simulateChannelListResponse(op,{kind:"youtube#channelListResponse",items:[
      {id:ID,snippet:{title:""}},
    ]},when)).toMatchObject({kind:"REJECTED_SIMULATION"});
  });

  it("classifies quota, auth, not found and transient errors without retrying",()=>{
    expect(classifyChannelApiFailure(403,"quotaExceeded")).toBe("QUOTA_EXCEEDED");
    expect(classifyChannelApiFailure(403,"dailyLimitExceeded")).toBe("QUOTA_EXCEEDED");
    expect(classifyChannelApiFailure(429,"rateLimitExceeded")).toBe("RATE_LIMITED");
    expect(classifyChannelApiFailure(401,"unauthorized")).toBe("AUTH_DENIED");
    expect(classifyChannelApiFailure(403,"forbidden")).toBe("AUTH_DENIED");
    expect(classifyChannelApiFailure(404,"channelNotFound")).toBe("NOT_FOUND");
    expect(classifyChannelApiFailure(400,"invalidCriteria")).toBe("BAD_REQUEST");
    expect(classifyChannelApiFailure(503,"backendError")).toBe("RETRYABLE_UPSTREAM");
    expect(classifyChannelApiFailure(200,null)).toBe("FAILED_CLOSED");
  });
});
