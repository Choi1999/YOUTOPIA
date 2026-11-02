"use strict";

/**
 * G4-5: PURE OFFLINE proposal generator. Never contacts YouTube, Cloud,
 * OAuth, a database or an LLM. A caller-provided approval/credential/role
 * must never turn this output into network authorization.
 */
const POLICY_HOLD = "POLICY_HOLD";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_VIDEOS = 3;
const MAX_THREADS_PER_VIDEO = 100;
const ALLOWED_INPUT_KEYS = new Set([
  "videoIds", "maxResults", "pageLimit", "order", "textFormat", "includeReplies"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function invalid(message) {
  const error = new TypeError("G45_OFFLINE_INVALID: " + message);
  error.code = "G45_OFFLINE_INVALID";
  throw error;
}

function proposeFirstPublicCommentRead(options) {
  if (!isRecord(options)) invalid("plain object required");
  for (const key of Reflect.ownKeys(options)) {
    if (typeof key !== "string" || !ALLOWED_INPUT_KEYS.has(key))
      invalid("unexpected option: " + String(key));
    const desc = Object.getOwnPropertyDescriptor(options, key);
    if (!desc || !Object.hasOwn(desc, "value")) invalid("accessor is not allowed");
  }

  const ids = options.videoIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_VIDEOS)
    invalid("1-3 explicit VIDEO IDs are required");
  if (!ids.every(id => typeof id === "string" && VIDEO_ID.test(id)))
    invalid("only 11-character canonical VIDEO IDs are supported");
  if (new Set(ids).size !== ids.length)
    invalid("duplicate video IDs are not allowed");

  const maxResults = options.maxResults === undefined ? MAX_THREADS_PER_VIDEO : options.maxResults;
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > MAX_THREADS_PER_VIDEO)
    invalid("maxResults must be an integer in [1,100]");
  if (options.pageLimit !== undefined && options.pageLimit !== 1)
    invalid("only one candidate page per VIDEO");
  if (options.order !== undefined && options.order !== "time")
    invalid("only time ordering is in this candidate contract");
  if (options.textFormat !== undefined && options.textFormat !== "plainText")
    invalid("only plainText is in this candidate contract");
  if (options.includeReplies !== undefined && options.includeReplies !== false)
    invalid("reply enumeration requires a separate approval and API contract");

  const candidates = Object.freeze(ids.map(videoId => Object.freeze({
    method: "commentThreads.list",
    source: "YOUTUBE",
    targetType: "VIDEO",
    targetId: videoId,
    part: "snippet",
    maxResults,
    order: "time",
    textFormat: "plainText",
    maxPages: 1,
    nextPageToken: null,
    expectedQuotaUnitsForOneRequest: 1
  })));

  return Object.freeze({
    contractVersion: "YU32_G4_5_OFFLINE_V01",
    status: "OFFLINE_CANDIDATE_ONLY",
    providerPolicy: POLICY_HOLD,
    collectionAuthorized: false,
    networkRequestsPermitted: 0,
    liveCredentialsAccepted: false,
    youtubeResultsFetched: 0,
    originalCommentsPersisted: 0,
    derivedMetricsAuthorized: false,
    sentimentOutput: null,
    sampleIsPopulation: false,
    repliesComplete: false,
    plannedUpperBoundRequests: ids.length,
    plannedQuotaUnitsWithoutRetries: ids.length,
    requestCandidates: candidates
  });
}

function policyGateSnapshot() {
  return Object.freeze({
    providerPolicy: POLICY_HOLD,
    rawCommentRead: "NOT_AUTHORIZED",
    derivedMetrics: "NOT_AUTHORIZED",
    rawRetention: "NOT_APPROVED",
    liveApiRequests: 0,
    sourceProjectVerified: false,
    totalProviderEvidenceVerified: 0,
    note: "No client parameter or offline test can lift this gate."
  });
}

module.exports = Object.freeze({
  proposeFirstPublicCommentRead,
  policyGateSnapshot,
  POLICY_HOLD
});
