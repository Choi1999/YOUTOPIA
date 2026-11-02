"use strict";
/*
 * YOUTOPIA G4-5 local offline planning ONLY.
 * No provider transport, no public HTTP listener and no credential reader.
 */
const {proposeFirstPublicCommentRead,policyGateSnapshot}=require("../source-plan.cjs");
const fs=require("node:fs");
const path=require("node:path");
const state=JSON.parse(fs.readFileSync(path.resolve(__dirname,"..","windows-local-boundary.v01.json"),"utf8"));
const secretNames=["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY"];
function output(obj){process.stdout.write(JSON.stringify(obj)+"\n");}
function execute(args) {
  if(secretNames.some(name=>Object.hasOwn(process.env,name)))
    throw new Error("credentials forbidden in offline mode");
  if(args.some(a=>["--run","--live","--execute"].includes(a)))
    throw new Error("live execution is blocked by POLICY_HOLD");
  if(state.status!=="OFFLINE_PRECHECK_ONLY"||state.policy!=="POLICY_HOLD"||
     state.approvals.makeRealYouTubeCall!==false||
     state.results.networkRequestsMade!==0||
     policyGateSnapshot().providerPolicy!=="POLICY_HOLD")
    throw new Error("offline safety gate failed");
  if(args.length===1&&args[0]==="--check") {
    output({status:"LOCAL_OFFLINE_PRECHECK_ONLY",
      platformObserved:process.platform,windowsHostObserved:process.platform==="win32",
      nodeMajor:Number(process.versions.node.split(".")[0]),
      providerRequests:0,collectionAuthorized:false,policy:"POLICY_HOLD"});
    return;
  }
  if(args[0]==="--plan"&&args.length>=2&&args.length<=4){
    const ids=args.slice(1).map(a=>{
      if(!/^--video-id=[A-Za-z0-9_-]{11}$/.test(a))
        throw new Error("invalid offline video-id flag");
      return a.slice("--video-id=".length);
    });
    const plan=proposeFirstPublicCommentRead({videoIds:ids,maxResults:100,pageLimit:1,
      order:"time",textFormat:"plainText",includeReplies:false});
    if(plan.collectionAuthorized!==false||plan.networkRequestsPermitted!==0)
      throw new Error("source policy gate failed");
    output({status:"LOCAL_OFFLINE_PLAN_ONLY",videoCount:ids.length,
      maxThreadsPerVideo:100,maxPagesPerVideo:1,
      estimatedRequests:plan.plannedUpperBoundRequests,
      estimatedQuotaUnits:plan.plannedQuotaUnitsWithoutRetries,
      providerRequests:0,collectionAuthorized:false,policy:"POLICY_HOLD"});
    return;
  }
  throw new Error("unsupported flags for offline-only CLI");
}
try {execute(process.argv.slice(2));}
catch {process.stderr.write("G45_LOCAL_STOP: unsupported, unsafe or live request rejected\n");
  process.exitCode=3;}
