import {describe,expect,it} from "vitest";
import policy from "../../../../shared/contracts/yu32-youtube-readiness-v0/policy-gates.json";
import {addWorkspaceUrlTargets} from "./workspaceUrlTargets";
import {
  assessChannelReadiness,
  READINESS_LIVE_CALL_AUTHORIZED,
  READINESS_RUNTIME_GATE,
  READINESS_REQUIREMENTS,
} from "./workspaceChannelReadiness";

const id="UC"+"A".repeat(22);
function registered(...links:string[]) {
  return addWorkspaceUrlTargets([],links.join("\n"),1_000).targets;
}

describe("UI-R04-H — repository-grounded fail-closed channel read readiness",()=>{
  it("uses the exact repository policy evidence instead of asserting Google Cloud account access",()=>{
    const result=assessChannelReadiness(registered(
      "https://www.youtube.com/channel/"+id,
      "https://youtube.com/@ExampleCreator",
    ));
    expect(READINESS_RUNTIME_GATE).toBe("POLICY_HOLD");
    expect(READINESS_LIVE_CALL_AUTHORIZED).toBe(false);
    expect(result).toMatchObject({
      mode:"REPOSITORY_EVIDENCE_REVIEW",
      decision:"BLOCKED",policyGate:"POLICY_HOLD",
      liveCallsAuthorized:false,networkExecuted:false,sourceValid:true,
      verifiedGates:0,
      requiredGates:READINESS_REQUIREMENTS.length,
      cloudAccountVerified:false,actualQuotaVerified:false,
      credentialsInspected:false,
    });
    expect(result.sourceReviewedOn).toBe(policy.reviewedOn);
    expect(result.gates.map(g=>g.id)).toEqual([
      "Y45-E01","Y45-E02","Y45-E03","Y45-E04",
      "Y45-E05","Y45-E09","Y45-E11","Y45-E12",
    ]);
    expect(result.gates.find(g=>g.id==="Y45-E11")?.evidenceStatus)
      .toBe("NOT_APPROVED");
  });

  it("proposes at most one non-executable snippet first-call candidate",()=>{
    const result=assessChannelReadiness(registered(
      "https://www.youtube.com/channel/"+id,
      "https://www.youtube.com/@OtherCreator",
    ));
    expect(result.firstCall).toEqual({
      method:"channels.list",part:"snippet",filter:"id",targetId:id,
      maxCalls:1,maxUnits:1,operator:"UNASSIGNED",
      approval:"NOT_APPROVED",executable:false,
    });
    expect(assessChannelReadiness(registered(
      "https://youtu.be/Ab0_-123xyz",
    )).firstCall).toBeNull();
  });

  it("fails closed if the policy switches on live calls or changes version",()=>{
    const changed={...policy,liveCallsAuthorized:true};
    const invalid=assessChannelReadiness(registered(
      "https://youtube.com/@ExampleCreator",
    ),changed);
    expect(invalid.sourceValid).toBe(false);
    expect(invalid.liveCallsAuthorized).toBe(false);
    expect(invalid.decision).toBe("BLOCKED");
    expect(invalid.gates.every(g=>g.evidenceStatus==="SOURCE_INVALID"))
      .toBe(true);
    expect(assessChannelReadiness([],{...policy,contractVersion:"UNKNOWN"})
      .sourceValid).toBe(false);
  });

  it("rejects duplicate, missing, unknown evidence statuses or forged approvals",()=>{
    const source=policy.evidence;
    const altered=[
      {...policy,evidence:source.slice(1)},
      {...policy,evidence:[...source,source[0]]},
      {...policy,evidence:source.map(x=>x.id==="Y45-E03"
        ? {...x,status:"VERIFIED"}:x)},
      {...policy,verifiedCount:1},
      {...policy,derivedSentimentAuthorized:true},
    ];
    for(const snapshot of altered){
      const result=assessChannelReadiness([],snapshot);
      expect(result.sourceValid).toBe(false);
      expect(result.decision).toBe("BLOCKED");
      expect(result.liveCallsAuthorized).toBe(false);
    }
  });

  it("does not let a large or invalid target registration turn into a first-call approval",()=>{
    const bad={kind:"CHANNEL" as const,id,
      canonicalUrl:"https://youtube.com.attacker.invalid/channel/"+id,
      addedAt:1000};
    const readiness=assessChannelReadiness([bad]);
    expect(readiness.firstCall).toBeNull();
    expect(readiness.networkExecuted).toBe(false);
    expect(readiness.decision).toBe("BLOCKED");
  });
});
