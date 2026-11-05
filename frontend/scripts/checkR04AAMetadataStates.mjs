// UI-R04-AA: Vite -> pinned Spring test-only synthetic metadata state smoke.
// No YouTube provider, no real key, no production endpoint, no Cloud activity.
import assert from "node:assert/strict";

const base = "http://127.0.0.1:5173/api/v1/youtube/metadata/synthetic-state";
for (const [route,status,httpCode] of [
  ["videos/Ab0_-123xyz", "READY", 200],
  ["videos/Ab0_-123xyz?scenario=NOT_FOUND", "NOT_FOUND", 404],
  ["videos/Ab0_-123xyz?scenario=FAILED", "FAILED", 503],
  ["videos/Ab0_-123xyz?scenario=STALE", "STALE", 200],
  ["channels/UC"+"A".repeat(22), "READY", 200],
  ["handles/%40samplecreator", "READY", 200],
]) {
  const res = await fetch(base+"/"+route, {
    method:"GET",credentials:"omit",redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(5000),
    headers:{Accept:"application/json"},
  });
  assert.equal(res.status,httpCode);
  assert.equal(res.headers.get("x-youtopia-synthetic"),"test-only");
  assert.match(res.headers.get("cache-control")??"",/no-store/);
  const text=await res.text();
  assert.ok(text.length<=4096);
  const obj=JSON.parse(text);
  assert.deepEqual(Object.keys(obj).sort(),[
    "artwork","associationVerified","channelId","channelName",
    "consumerPublicationAuthorized","expiresAt","failureCode","kind",
    "observedAt","providerRequestsMade","requestedId","schema","source",
    "sourceAuthenticated","status","title",
  ]);
  assert.equal(obj.schema,"YOUTOPIA_R04Z_METADATA_CONSUMER_STATE_V01");
  assert.equal(obj.status,status);
  assert.equal(obj.source,"LOCAL_SYNTHETIC_ONLY");
  assert.equal(obj.sourceAuthenticated,false);
  assert.equal(obj.consumerPublicationAuthorized,false);
  assert.equal(obj.providerRequestsMade,0);
  assert.equal(obj.channelId,null);
  assert.equal(obj.associationVerified,false);
  if (status==="READY") {
    assert.match(obj.title,/^합성 /);
    assert.ok(obj.expiresAt>Date.now());
  } else if(status==="STALE") {
    assert.ok(obj.expiresAt<Date.now());
  } else {
    assert.equal(obj.title,null);
    assert.equal(obj.artwork,null);
  }
  assert.ok(!text.includes("apiKey"));
  assert.ok(!text.includes("thumbnailUrl"));
}
const rejected=await fetch(base+"/videos/invalid-target-length",{
  credentials:"omit",redirect:"error",signal:AbortSignal.timeout(5000)
});
assert.equal(rejected.status,400);
assert.ok(!(await rejected.text()).includes("invalid-target-length"));
console.log("UI-R04-AA cross-process state contract PASS: 6 responses, " +
  "bad ID rejected, YouTube/Cloud requests 0");
