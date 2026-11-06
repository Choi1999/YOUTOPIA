// UI-R04-AG: pinned backend #96 + Vite DEV same-origin deny-path probe.
// NO real provider/API/Cloud, account cookies, key or transport promotion.
import assert from "node:assert/strict";

const spring="http://127.0.0.1:8765";
const vite="http://127.0.0.1:5173";
const path="/api/v1/youtube/metadata/consumer-offline/videos/Ab0_-123xyz";
const deniedRequest={
  method:"GET",redirect:"error",credentials:"omit",cache:"no-store",
  headers:{Accept:"application/problem+json"},
  signal:AbortSignal.timeout(5000),
};

// The pinned R04X synthetic loopback does NOT mount the AF MockMvc controller:
// proving this path is not an accidentally exposed live provider endpoint.
const [direct,proxied]=await Promise.all([
  fetch(spring+path,deniedRequest),
  fetch(vite+path,deniedRequest),
]);
assert.ok(direct.status>=400 && direct.status<600,
  "Spring synthetic server must reject the unregistered AF consumer route");
assert.equal(proxied.status,direct.status,
  "Vite must actually forward to the pinned Spring loopback server");
const directBody=await direct.text();
const proxyBody=await proxied.text();
assert.ok(proxyBody.length<=4096);
assert.equal(proxyBody,directBody);
assert.doesNotMatch(proxyBody,/"sourceAuthenticated"\s*:\s*true/);
assert.doesNotMatch(proxyBody,/"status"\s*:\s*"READY"/);
assert.ok(!proxyBody.includes("apiKey") && !proxyBody.includes("thumbnailUrl"));

// A genuine 503 travels through Vite from the pinned Spring TEST-only
// synthetic-state failure fixture. This is NOT an authenticated AF 503:
// AF's 401/403/503 policy cases are separately proven by pinned MockMvc.
const statePath="/api/v1/youtube/metadata/synthetic-state/videos/Ab0_-123xyz?scenario=FAILED";
const failed=await fetch(vite+statePath,{
  method:"GET",redirect:"error",credentials:"omit",
  cache:"no-store",signal:AbortSignal.timeout(5000),
  headers:{Accept:"application/json"},
});
assert.equal(failed.status,503);
assert.equal(failed.headers.get("x-youtopia-synthetic"),"test-only");
assert.match(failed.headers.get("cache-control")??"",/no-store/);
const text=await failed.text();
assert.ok(text.length<=4096);
const payload=JSON.parse(text);
assert.equal(payload.schema,"YOUTOPIA_R04Z_METADATA_CONSUMER_STATE_V01");
assert.equal(payload.status,"FAILED");
assert.equal(payload.source,"LOCAL_SYNTHETIC_ONLY");
assert.equal(payload.sourceAuthenticated,false);
assert.equal(payload.consumerPublicationAuthorized,false);
assert.equal(payload.providerRequestsMade,0);
assert.equal(payload.title,null);
assert.equal(payload.artwork,null);
assert.equal(payload.failureCode,"FIXTURE_UNAVAILABLE");

console.log("UI-R04-AG paired offline smoke PASS: pinned Spring denied AF route " +
  "remains unpublished, Vite forwarded the deny status, and pinned Spring " +
  "synthetic 503 FAILED remains unauthenticated; real API/keys/cloud=0. " +
  "AF actual 401/403/503 authenticated policy behavior is separately MockMvc-tested.");
