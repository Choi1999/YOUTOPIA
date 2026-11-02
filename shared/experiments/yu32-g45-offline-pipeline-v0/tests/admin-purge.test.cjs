"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createSyntheticPurgeHarness,CONFIRM}=require("../src/admin-purge.cjs");
const source=fs.readFileSync(path.resolve(__dirname,"../src/admin-purge.cjs"),"utf8");
const VIDEO="Ab0_-123xyz",EXPIRED_VIDEO="Zb0_-123xyz";
const ID1="11111111-1111-4111-8111-111111111111",ID2="22222222-2222-4222-8222-222222222222";
const ID3="33333333-3333-4333-8333-333333333333";
function setup(){
  const h=createSyntheticPurgeHarness();
  const admin=h.syntheticActorForTests("ADMIN","tenant-alpha");
  const member=h.syntheticActorForTests("USER","tenant-alpha");
  const other=h.syntheticActorForTests("ADMIN","tenant-beta");
  const system=h.syntheticActorForTests("SYSTEM");
  const request={
    actor:admin,tenantId:"tenant-alpha",videoId:VIDEO,
    revision:1,requestId:ID1,confirmation:CONFIRM,
    reasonCode:"ADMIN_REQUEST",at:"2026-11-02T09:00:00Z"
  };
  return {h,admin,member,other,system,request};
}
function denied(f){assert.throws(f,/G45_PURGE_REJECTED/);}
test("G45-D01: only authenticated fixture-admin can inspect a tenant VIDEO deletion preview",()=>{
  const {h,admin}=setup();
  const p=h.preview({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO});
  assert.equal(p.state,"PREVIEW_ONLY");
  assert.equal(p.revision,1);
  assert.equal(p.requiresConfirmation,CONFIRM);
  assert.deepEqual(p.affected,{snapshots:1,cachedCards:1,topicIndexes:1,
    reports:1,jobs:1,outbox:1,rawComments:0});
});
test("G45-D02: regular member cannot preview or execute admin purge",()=>{
  const {h,member,request}=setup();
  denied(()=>h.preview({actor:member,tenantId:"tenant-alpha",videoId:VIDEO}));
  denied(()=>h.adminDelete({...request,actor:member}));
});
test("G45-D03: client-crafted ADMIN role object cannot forge a trusted session",()=>{
  const {h,request}=setup();
  const fake={kind:"ADMIN",tenantId:"tenant-alpha",syntheticOnly:true};
  denied(()=>h.preview({actor:fake,tenantId:"tenant-alpha",videoId:VIDEO}));
  denied(()=>h.adminDelete({...request,actor:fake}));
  denied(()=>h.adminDelete({...request,actor:null}));
});
test("G45-D04: same-video data from a different tenant must be protected",()=>{
  const {h,other,request}=setup();
  denied(()=>h.adminDelete({...request,actor:other}));
  denied(()=>h.preview({actor:other,tenantId:"tenant-alpha",videoId:VIDEO}));
  assert.equal(h.inspect({actor:other,tenantId:"tenant-beta",videoId:VIDEO}).exists,true);
});
test("G45-D05: manual deletion requires exact confirmation phrase",()=>{
  const {h,request}=setup();
  for(const confirm of ["yes","DELETE","delete_youtopia_data","DELETE_YOUTOPIA_DATA "])
    denied(()=>h.adminDelete({...request,confirmation:confirm}));
  assert.equal(h.inspect({actor:request.actor,tenantId:request.tenantId,videoId:VIDEO}).exists,true);
});
test("G45-D06: manual deletion requires allowlisted reason and valid UUID",()=>{
  const {h,request}=setup();
  for(const reasonCode of ["","UNRESTRICTED","USER_REQUEST","admin_request"])
    denied(()=>h.adminDelete({...request,reasonCode}));
  denied(()=>h.adminDelete({...request,requestId:"not-uuid"}));
  denied(()=>h.adminDelete({...request,at:"2026-02-30T01:00:00Z"}));
});
test("G45-D07: manual deletion requires preview revision matching the record",()=>{
  const {h,request}=setup();
  denied(()=>h.adminDelete({...request,revision:99}));
  denied(()=>h.adminDelete({...request,revision:0}));
  assert.equal(h.inspect({actor:request.actor,tenantId:request.tenantId,videoId:VIDEO}).exists,true);
});
test("G45-D08: delete removes dependent snapshots, cache, index, reports, jobs and outbox",()=>{
  const {h,admin,request}=setup();
  const result=h.adminDelete(request);
  assert.equal(result.status,"PURGED_SYNTHETIC_ONLY");
  assert.equal(result.tombstoned,true);
  assert.equal(result.providerRequestsMade,0);
  for(const name of ["snapshots","cachedCards","topicIndexes","reports","jobs","outbox"])
    assert.equal(result.removed[name],1,name);
  assert.equal(result.removed.rawComments,0);
  assert.deepEqual(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO}),
    {exists:false,tombstoned:true,affected:null,providerRequestsMade:0});
});
test("G45-D09: tombstone prevents queued retry from restoring deleted VIDEO data",()=>{
  const {h,system,request}=setup();
  assert.equal(h.syntheticReplayAttempt({actor:system,tenantId:"tenant-alpha",videoId:VIDEO}).status,
    "SYNTHETIC_RECORD_STILL_PRESENT");
  h.adminDelete(request);
  assert.equal(h.syntheticReplayAttempt({actor:system,tenantId:"tenant-alpha",videoId:VIDEO}).status,
    "REPLAY_BLOCKED_BY_TOMBSTONE");
  denied(()=>h.preview({actor:request.actor,tenantId:"tenant-alpha",videoId:VIDEO}));
});
test("G45-D10: same idempotency key and unchanged request cannot double-delete",()=>{
  const {h,request,admin}=setup();
  const first=h.adminDelete(request);
  const second=h.adminDelete(request);
  assert.equal(first.replayed,undefined);
  assert.equal(second.replayed,true);
  assert.equal(second.status,"PURGED_SYNTHETIC_ONLY");
  assert.equal(h.auditTrail(admin).length,1);
});
test("G45-D11: reusing operation UUID with a different target or reason conflicts",()=>{
  const {h,request}=setup();
  h.adminDelete(request);
  denied(()=>h.adminDelete({...request,videoId:EXPIRED_VIDEO}));
  denied(()=>h.adminDelete({...request,reasonCode:"DATA_QUALITY"}));
  denied(()=>h.adminDelete({...request,at:"2026-11-03T00:00:00Z"}));
});
test("G45-D12: manual purge never removes another video or tenant's data",()=>{
  const {h,admin,other,request}=setup();
  h.adminDelete(request);
  assert.equal(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:EXPIRED_VIDEO}).exists,true);
  assert.equal(h.inspect({actor:other,tenantId:"tenant-beta",videoId:VIDEO}).exists,true);
});
test("G45-D13: admin audit records are minimized, tenant scoped, immutable copies",()=>{
  const {h,admin,other,request}=setup();
  h.adminDelete(request);
  const audit=h.auditTrail(admin);
  assert.equal(audit.length,1);
  assert.equal(h.auditTrail(other).length,0);
  assert.equal(audit[0].actorKind,"ADMIN");
  assert.equal(audit[0].reasonCode,"ADMIN_REQUEST");
  assert.equal(audit[0].operationId,ID1);
  assert.ok(Object.isFrozen(audit[0]));
  const raw=JSON.stringify(audit);
  for(const value of ["textOriginal","authorDisplayName","synthetic-comment-",
    "apiKey","OAuth","rawCommentText","SYNTHETIC_USER"])
    assert.ok(!raw.includes(value),value);
});
test("G45-D14: random/unknown input keys and global deletion attempts are rejected",()=>{
  const {h,admin,request}=setup();
  denied(()=>h.adminDelete({...request,role:"ADMIN"}));
  denied(()=>h.adminDelete({...request,allTenants:true}));
  denied(()=>h.preview({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO,scope:"ALL"}));
  denied(()=>h.adminDelete({...request,tenantId:"*"}));
  denied(()=>h.adminDelete({...request,videoId:"ALL"}));
});
test("G45-D15: system expiry removes only expired synthetic records without admin click",()=>{
  const {h,admin,other,system}=setup();
  const result=h.systemExpire({actor:system,at:"2026-11-02T09:00:00Z"});
  assert.equal(result.status,"SYNTHETIC_EXPIRY_PASS");
  assert.equal(result.deleted,1);
  assert.equal(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:EXPIRED_VIDEO}).tombstoned,true);
  assert.equal(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO}).exists,true);
  assert.equal(h.inspect({actor:other,tenantId:"tenant-beta",videoId:VIDEO}).exists,true);
});
test("G45-D16: admin and normal user cannot impersonate system retention worker",()=>{
  const {h,admin,member}=setup();
  denied(()=>h.systemExpire({actor:admin,at:"2026-11-02T09:00:00Z"}));
  denied(()=>h.systemExpire({actor:member,at:"2026-11-02T09:00:00Z"}));
  denied(()=>h.systemExpire({actor:{kind:"SYSTEM"},at:"2026-11-02T09:00:00Z"}));
});
test("G45-D17: unexpired records are not deleted by the expiry pass",()=>{
  const {h,admin,system}=setup();
  const result=h.systemExpire({actor:system,at:"2026-10-30T00:00:00Z"});
  assert.equal(result.deleted,0);
  assert.equal(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO}).exists,true);
});
test("G45-D18: verified deletion request is completed by system without admin bottleneck",()=>{
  const {h,system,admin}=setup();
  const result=h.systemVerifiedUserErasure({actor:system,tenantId:"tenant-alpha",
    videoId:VIDEO,requestId:ID2,requestedAt:"2026-11-01T09:00:00Z",
    at:"2026-11-02T09:00:00Z"});
  assert.equal(result.deadlineStatus,"WITHIN_7_DAYS");
  assert.equal(result.status,"PURGED_SYNTHETIC_ONLY");
  assert.equal(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO}).exists,false);
  assert.equal(h.auditTrail(admin)[0].reasonCode,"VERIFIED_USER_ERASURE");
});
test("G45-D19: late user-request processing still deletes data, but flags SLA breach",()=>{
  const {h,system,admin}=setup();
  const result=h.systemVerifiedUserErasure({actor:system,tenantId:"tenant-alpha",
    videoId:VIDEO,requestId:ID2,requestedAt:"2026-10-01T09:00:00Z",
    at:"2026-11-02T09:00:00Z"});
  assert.equal(result.deadlineStatus,"SLA_BREACH");
  assert.equal(h.inspect({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO}).tombstoned,true);
});
test("G45-D20: verified user-request operation is idempotent and role restricted",()=>{
  const {h,system,admin,member}=setup();
  const req={actor:system,tenantId:"tenant-alpha",videoId:VIDEO,
    requestId:ID3,requestedAt:"2026-11-01T09:00:00Z",at:"2026-11-02T09:00:00Z"};
  denied(()=>h.systemVerifiedUserErasure({...req,actor:member}));
  denied(()=>h.systemVerifiedUserErasure({...req,actor:admin}));
  const first=h.systemVerifiedUserErasure(req);
  const again=h.systemVerifiedUserErasure(req);
  assert.equal(first.replayed,undefined);
  assert.equal(again.replayed,true);
  denied(()=>h.systemVerifiedUserErasure({...req,tenantId:"tenant-beta"}));
});
test("G45-D21: manual admin actor cannot delete across all tenants via audit or replay",()=>{
  const {h,admin,other,system,request}=setup();
  h.adminDelete(request);
  denied(()=>h.syntheticReplayAttempt({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO}));
  denied(()=>h.auditTrail(system));
  assert.equal(h.auditTrail(other).length,0);
});
test("G45-D22: all supported simulated deletes have zero provider calls and never delete on YouTube",()=>{
  const {h,system,admin,request}=setup();
  const before=h.preview({actor:admin,tenantId:"tenant-alpha",videoId:VIDEO});
  assert.equal(before.providerRequestsMade,0);
  const deleted=h.adminDelete(request);
  assert.equal(deleted.providerRequestsMade,0);
  const result=h.systemExpire({actor:system,at:"2026-11-02T10:00:00Z"});
  assert.equal(result.providerRequestsMade,0);
  assert.doesNotMatch(source,/\bfetch\s*\(|node:https|node:http|axios|googleapis|child_process|spawnSync/);
  assert.doesNotMatch(source,/fs\.write|fs\.unlink|DROP TABLE|DELETE FROM|youtopia-513507/);
});
