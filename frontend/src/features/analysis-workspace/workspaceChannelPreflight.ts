import {
  parseWorkspaceYouTubeUrl,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import {
  isApprovedChannelThumbnailUrl,
  validateApprovedChannelProfile,
  type ApprovedChannelProfile,
} from "./workspaceChannelProfile";

/**
 * UI-R04-G: a deterministic, network-free proposal for potential future
 * channels.list(part=snippet) requests. No client, key, fetch, URL request
 * builder, environment-variable read or live authorization is included.
 */
export const CHANNEL_PREFLIGHT_GATE = "POLICY_HOLD" as const;
export const CHANNEL_PREFLIGHT_UNIT_COST = 1;
export const CHANNEL_PREFLIGHT_MAX_IDS_PER_CALL = 50;
export const CHANNEL_PREFLIGHT_MAX_TARGETS = 128;
export const CHANNEL_PREFLIGHT_REVIEW_BUDGET = 10;

const ID = /^UC[A-Za-z0-9_-]{22}$/;
const HANDLE = /^@[\p{L}\p{N}._-]{3,30}$/u;

type ChannelTarget = Pick<WorkspaceUrlTarget, "kind" | "id" | "canonicalUrl">;

export type PlannedChannelRead = Readonly<{
  method: "GET";
  resource: "channels.list";
  part: "snippet";
  filter: "id" | "forHandle";
  values: readonly string[];
  maxResults: number;
  estimatedUnits: 1;
}>;

export type ChannelMetadataPreflight = Readonly<{
  mode: "OFFLINE_PLAN_ONLY";
  policyGate: "POLICY_HOLD";
  networkExecuted: false;
  channelTargets: number;
  ignoredVideos: number;
  duplicates: number;
  operations: readonly PlannedChannelRead[];
  estimatedUnits: number;
  reviewBudget: number;
  budgetStatus: "WITHIN_LIMIT" | "BUDGET_EXCEEDED" | "INVALID_INPUT";
  liveRequestAuthorized: false;
}>;

function invalid(reviewBudget: number): ChannelMetadataPreflight {
  return {
    mode:"OFFLINE_PLAN_ONLY",
    policyGate:CHANNEL_PREFLIGHT_GATE,
    networkExecuted:false,
    channelTargets:0,ignoredVideos:0,duplicates:0,
    operations:[],estimatedUnits:0,
    reviewBudget,
    budgetStatus:"INVALID_INPUT",
    liveRequestAuthorized:false,
  };
}

/** The target's canonical URL, kind and ID must all match exactly. */
function validRegistration(item: ChannelTarget): boolean {
  if (!item || typeof item !== "object" || typeof item.id !== "string" ||
      typeof item.canonicalUrl !== "string") return false;
  const canonical = parseWorkspaceYouTubeUrl(item.canonicalUrl);
  return canonical !== null && canonical.id === item.id &&
    canonical.kind === item.kind &&
    canonical.canonicalUrl === item.canonicalUrl;
}

export function planOfflineChannelMetadata(
  targets: readonly ChannelTarget[],
  reviewBudget = CHANNEL_PREFLIGHT_REVIEW_BUDGET,
): ChannelMetadataPreflight {
  if (!Array.isArray(targets) || targets.length > CHANNEL_PREFLIGHT_MAX_TARGETS ||
      !Number.isSafeInteger(reviewBudget) || reviewBudget < 0 ||
      reviewBudget > CHANNEL_PREFLIGHT_MAX_TARGETS ||
      targets.some(item => !validRegistration(item))) {
    return invalid(reviewBudget);
  }

  const ids: string[] = [];
  const handles: string[] = [];
  const seen = new Set<string>();
  let duplicates=0,ignoredVideos=0;
  for (const target of targets) {
    if (target.kind === "VIDEO") {ignoredVideos++;continue;}
    const key=target.kind+":"+target.id;
    if (seen.has(key)) {duplicates++;continue;}
    seen.add(key);
    if (target.kind === "CHANNEL") ids.push(target.id);
    else handles.push(target.id);
  }
  const operations: PlannedChannelRead[]=[];
  // A single ID-filter call may request up to 50 IDs; a handle requires its
  // own forHandle filter call. Filters must never be mixed in one request.
  for(let at=0;at<ids.length;at+=CHANNEL_PREFLIGHT_MAX_IDS_PER_CALL) {
    const slice=ids.slice(at,at+CHANNEL_PREFLIGHT_MAX_IDS_PER_CALL);
    operations.push({
      method:"GET",resource:"channels.list",part:"snippet",
      filter:"id",values:slice,maxResults:slice.length,estimatedUnits:1,
    });
  }
  for(const handle of handles) {
    operations.push({
      method:"GET",resource:"channels.list",part:"snippet",
      filter:"forHandle",values:[handle],maxResults:1,estimatedUnits:1,
    });
  }
  return {
    mode:"OFFLINE_PLAN_ONLY",
    policyGate:CHANNEL_PREFLIGHT_GATE,
    networkExecuted:false,
    channelTargets:ids.length+handles.length,
    ignoredVideos,duplicates,
    operations,estimatedUnits:operations.length*CHANNEL_PREFLIGHT_UNIT_COST,
    reviewBudget,
    budgetStatus:operations.length > reviewBudget
      ? "BUDGET_EXCEEDED":"WITHIN_LIMIT",
    liveRequestAuthorized:false,
  };
}

export type OfflineChannelResponseResult =
  | Readonly<{
      kind:"ACCEPTED_SIMULATION";
      profiles:readonly ApprovedChannelProfile[];
      notFound:readonly string[];
      networkExecuted:false;
    }>
  | Readonly<{
      kind:"REJECTED_SIMULATION";
      reason:"INVALID_PLAN" | "MALFORMED_RESPONSE" | "IDENTITY_MISMATCH";
      networkExecuted:false;
    }>;

function rejected(reason: "INVALID_PLAN" | "MALFORMED_RESPONSE" | "IDENTITY_MISMATCH"):
  OfflineChannelResponseResult {
  return {kind:"REJECTED_SIMULATION",reason,networkExecuted:false};
}

function validOperation(op: PlannedChannelRead): boolean {
  return op && op.method==="GET" && op.resource==="channels.list" &&
    op.part==="snippet" && op.estimatedUnits===1 &&
    Array.isArray(op.values) && op.values.length>=1 &&
    op.values.length<=CHANNEL_PREFLIGHT_MAX_IDS_PER_CALL &&
    op.maxResults===op.values.length &&
    (op.filter==="id"
      ? op.values.every(v=>typeof v==="string"&&ID.test(v))
      : op.filter==="forHandle" && op.values.length===1 &&
        typeof op.values[0]==="string" && HANDLE.test(op.values[0]));
}

function object(value: unknown): value is Record<string,unknown> {
  return typeof value==="object" && value!==null && !Array.isArray(value);
}

function profileImage(snippet: Record<string,unknown>): string | null {
  if (!object(snippet.thumbnails)) return null;
  for(const size of ["high","medium","default"]){
    const node=snippet.thumbnails[size];
    if (object(node) && isApprovedChannelThumbnailUrl(node.url))
      return node.url;
  }
  return null;
}

/**
 * Parses an ALREADY-SUPPLIED offline fixture with a channels.list-like
 * shape. This does not fetch, execute a request plan, touch caches, or
 * authorize any future network call.
 *
 * For forHandle, only one returned item can be associated with the exact
 * requested handle; the API filter itself must be approved separately.
 * We never infer handles from snippet.customUrl or from channel titles.
 */
export function simulateChannelListResponse(
  op: PlannedChannelRead,
  raw: unknown,
  now = Date.now(),
): OfflineChannelResponseResult {
  if (!validOperation(op) || !Number.isSafeInteger(now) || now<0) {
    return rejected("INVALID_PLAN");
  }
  if (!object(raw) || raw.kind!=="youtube#channelListResponse" ||
      !Array.isArray(raw.items) || raw.items.length>op.maxResults ||
      raw.items.length>CHANNEL_PREFLIGHT_MAX_IDS_PER_CALL) {
    return rejected("MALFORMED_RESPONSE");
  }

  const used=new Set<string>();
  const profiles: ApprovedChannelProfile[]=[];
  for(const item of raw.items) {
    if (!object(item) || typeof item.id!=="string" || !ID.test(item.id) ||
        !object(item.snippet) || typeof item.snippet.title!=="string" ||
        used.has(item.id)) return rejected("MALFORMED_RESPONSE");
    used.add(item.id);
    if (op.filter==="id" && !op.values.includes(item.id))
      return rejected("IDENTITY_MISMATCH");
    const candidate = {
      source:"APPROVED_CHANNEL_SNIPPET" as const,
      channelId:item.id,
      handle:op.filter==="forHandle" ? op.values[0] : null,
      title:item.snippet.title,
      thumbnailUrl:profileImage(item.snippet),
      retrievedAt:now,
    };
    const profile=validateApprovedChannelProfile(candidate,now);
    if (!profile) return rejected("MALFORMED_RESPONSE");
    profiles.push(profile);
  }
  if (op.filter==="forHandle" && profiles.length>1)
    return rejected("MALFORMED_RESPONSE");
  return {
    kind:"ACCEPTED_SIMULATION",
    profiles,
    notFound:op.filter==="id"
      ? op.values.filter(id=>!used.has(id))
      : profiles.length ? [] : [...op.values],
    networkExecuted:false,
  };
}

export type ChannelPreflightFailure =
  "QUOTA_EXCEEDED" | "RATE_LIMITED" | "AUTH_DENIED" |
  "NOT_FOUND" | "BAD_REQUEST" | "RETRYABLE_UPSTREAM" |
  "FAILED_CLOSED";

/**
 * Offline classification only. No retries here. Quota/auth failures must
 * never be automatically retried into an actual live API request.
 */
export function classifyChannelApiFailure(
  status: number,
  reason: string | null | undefined,
): ChannelPreflightFailure {
  if (!Number.isSafeInteger(status) || status<400 || status>599)
    return "FAILED_CLOSED";
  if (status===404 || reason==="channelNotFound") return "NOT_FOUND";
  if (reason==="quotaExceeded" || reason==="dailyLimitExceeded" ||
      reason==="dailyLimitExceededUnreg") return "QUOTA_EXCEEDED";
  if (status===429 || reason==="rateLimitExceeded" ||
      reason==="userRateLimitExceeded") return "RATE_LIMITED";
  if (status===401 || status===403) return "AUTH_DENIED";
  if (status===400) return "BAD_REQUEST";
  if (status>=500) return "RETRYABLE_UPSTREAM";
  return "FAILED_CLOSED";
}
