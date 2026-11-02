"use strict";
/**
 * Fixed synthetic admin-data-deletion demo, not a real operator interface.
 * No CLI-supplied target/role/ticket, no network/DB/filesystem destructive API.
 * Test-only session minting must never be reused for production authentication.
 */
const {createSyntheticPurgeHarness,CONFIRM}=require("../src/admin-purge.cjs");
const forbidden=["GOOGLE_API_KEY","YOUTUBE_API_KEY","YOUTOPIA_YOUTUBE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS","YOUTUBE_OAUTH_TOKEN"];
function stop(){
  process.stderr.write("G45_PURGE_DEMO_STOP: synthetic-only admin deletion; no live data\n");
  process.exitCode=3;
}
function run(args){
  if(forbidden.some(x=>Object.hasOwn(process.env,x)))
    throw new Error("secrets not allowed in demo");
  if(args.length!==1)throw new Error("one hardcoded demonstration flag only");
  if(args[0]==="--check") {
    process.stdout.write(JSON.stringify({status:"SYNTHETIC_ADMIN_DELETE_ONLY",
      deleteActualData:false,realProviderRequests:0,productionAdminAuth:false,
      productionStorage:false,userErasureNeedsAdmin:false,
      requiredRealAdminRole:"ADMIN",policy:"POLICY_HOLD"})+"\n");
    return;
  }
  const h=createSyntheticPurgeHarness();
  const admin=h.syntheticActorForTests("ADMIN","tenant-alpha");
  const system=h.syntheticActorForTests("SYSTEM");
  const v="Ab0_-123xyz";
  if(args[0]==="--demo-admin-delete"){
    const preview=h.preview({actor:admin,tenantId:"tenant-alpha",videoId:v});
    const result=h.adminDelete({actor:admin,tenantId:"tenant-alpha",
      videoId:v,revision:preview.revision,
      requestId:"11111111-1111-4111-8111-111111111111",confirmation:CONFIRM,
      reasonCode:"ADMIN_REQUEST",at:"2026-11-02T09:00:00Z"});
    process.stdout.write(JSON.stringify({preview,result,active:h.inspect({
      actor:admin,tenantId:"tenant-alpha",videoId:v}),
      auditEventCount:h.auditTrail(admin).length,syntheticOnly:true})+"\n");
    return;
  }
  if(args[0]==="--demo-expiry"){
    const result=h.systemExpire({actor:system,at:"2026-11-02T09:00:00Z"});
    process.stdout.write(JSON.stringify({result,syntheticOnly:true})+"\n");
    return;
  }
  if(args[0]==="--demo-user-erasure"){
    const result=h.systemVerifiedUserErasure({
      actor:system,tenantId:"tenant-alpha",videoId:v,
      requestId:"22222222-2222-4222-8222-222222222222",
      requestedAt:"2026-11-01T09:00:00Z",at:"2026-11-02T09:00:00Z"});
    process.stdout.write(JSON.stringify({result,syntheticOnly:true})+"\n");
    return;
  }
  throw new Error("no real deletion command is supported");
}
try{run(process.argv.slice(2));}
catch{stop();}
