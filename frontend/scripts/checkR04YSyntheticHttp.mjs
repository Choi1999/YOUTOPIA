// UI-R04-Y: same-origin Vite -> isolated Spring test server HTTP smoke.
// No real API, no authentication, no credential material, no YouTube network.
// The hostname is fixed loopback and cannot be supplied by callers.
import assert from "node:assert/strict";

const root = "http://127.0.0.1:5173/api/v1/youtube/metadata/synthetic";
const schemas = [
  ["videos/Ab0_-123xyz", "VIDEO", "Ab0_-123xyz", "VIDEO_PLACEHOLDER"],
  ["channels/UC" + "A".repeat(22), "CHANNEL", "UC" + "A".repeat(22),
    "CHANNEL_PLACEHOLDER"],
  ["handles/%40samplecreator", "CHANNEL_HANDLE", "@samplecreator",
    "CHANNEL_PLACEHOLDER"],
];

let passed = 0;
for (const [route, kind, id, artwork] of schemas) {
  const result = await fetch(root + "/" + route, {
    redirect: "error", credentials: "omit", cache: "no-store",
    signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" },
  });
  assert.equal(result.status, 200, "Spring fixture synthetic GET expected");
  assert.equal(result.headers.get("x-youtopia-synthetic"), "test-only");
  assert.match(result.headers.get("content-type") ?? "", /^application\/json/i);
  assert.match(result.headers.get("cache-control") ?? "", /no-store/);
  const raw = await result.text();
  assert.ok(raw.length <= 4096);
  const object = JSON.parse(raw);
  assert.equal(object.schema, "YOUTOPIA_R04W_SYNTHETIC_METADATA_INTEGRATION_V01");
  assert.equal(object.status, "SYNTHETIC_NOT_PROVIDER_DATA");
  assert.deepEqual(Object.keys(object).sort(), ["record", "schema", "status"]);
  const record = object.record;
  assert.deepEqual(Object.keys(record).sort(), [
    "artwork", "channelName", "consumerPublicationAuthorized", "kind",
    "providerRequestsMade", "requestedId", "source", "sourceAuthenticated", "title",
  ]);
  assert.equal(record.source, "LOCAL_SYNTHETIC_ONLY");
  assert.equal(record.kind, kind);
  assert.equal(record.requestedId, id);
  assert.equal(record.artwork, artwork);
  assert.equal(record.sourceAuthenticated, false);
  assert.equal(record.providerRequestsMade, 0);
  assert.equal(record.consumerPublicationAuthorized, false);
  assert.ok(record.title.startsWith("합성 "));
  assert.equal(typeof record.channelName,kind === "VIDEO" ? "string" : "object");
  assert.ok(!raw.includes("apiKey") && !raw.includes("thumbnailUrl"));
  passed++;
}

// A malformed ID never returns mock 200. Other routes remain disabled.
const bad = await fetch(root + "/videos/definitely-invalid", {
  redirect: "error", credentials: "omit", signal: AbortSignal.timeout(5000),
});
assert.equal(bad.status, 400);
assert.ok(!(await bad.text()).includes("definitely-invalid"));
const unrelated = await fetch(root + "/unapproved/route", {
  redirect: "error", credentials: "omit", signal: AbortSignal.timeout(5000),
});
assert.ok(!unrelated.ok);
console.log("UI-R04-Y Vite-to-Spring loopback synthetic HTTP smoke PASS: " +
  passed + " canonical responses, fail-closed invalid/unknown paths; real YouTube 0");
