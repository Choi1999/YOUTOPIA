import {
  parseWorkspaceYouTubeUrl,
  workspaceUrlTargetKey,
  WORKSPACE_MAX_URL_TARGETS,
  type WorkspaceUrlTarget,
} from "./workspaceUrlTargets";
import {
  WORKSPACE_MAX_NODE_GROUPS,
  WORKSPACE_MAX_GROUP_MEMBERS,
  type WorkspaceNodeGroup,
} from "./workspaceNodeGroups";

/**
 * R05-B1 — Pure, bounded GraphProjection. The R04 URL canvas, persistence,
 * topology, Chrome extension, routes and API transports are NOT modified.
 * Caller-supplied provenance is data, not authentication: an authorized,
 * validated source adapter must verify claims before constructing this input.
 */
export const R05_GRAPH_PROJECTION_SCHEMA = "R05_GRAPH_PROJECTION_V1" as const;
export const R05_MAX_SEARCH_VIDEOS = 10;
export const R05_MAX_SAMPLE_SNAPSHOTS = 3;
export const R05_MAX_EXPRESSIONS = 8;

export type R05SourceKind =
  | "USER_CSV_UNVERIFIED"
  | "YOUTUBE_API_FIRST_PAGE_PUBLIC"
  | "SYNTHETIC_FIXTURE";
export type R05SourceStatus =
  | "READY" | "PARTIAL" | "STALE" | "NO_DATA"
  | "POLICY_BLOCKED" | "FAILED";
export type R05NodeKind =
  | "VIDEO" | "CHANNEL" | "CHANNEL_HANDLE_CANDIDATE"
  | "KEYWORD" | "EXPRESSION" | "EVIDENCE_SET" | "GROUP";
export type R05EdgeKind =
  | "RETURNED_BY_SEARCH" | "CHANNEL_PUBLISHES_VIDEO"
  | "VIDEO_HAS_SAMPLE" | "LEXICAL_COOCCURRENCE"
  | "USER_GROUP_MEMBERSHIP";
export type R05Provenance = Readonly<{
  kind: "USER_INPUT" | "UNVERIFIED_URL" | "USER_GROUP"
    | "YOUTUBE_API_SEARCH" | R05SourceKind;
  scopeId: string | null;
  snapshotId: string | null;
}>;
export type R05GraphNode = Readonly<{
  key: string;
  kind: R05NodeKind;
  label: string;
  status: "UNVERIFIED" | "USER_SELECTED" | "SEARCH_CANDIDATE" | R05SourceStatus;
  provenance: R05Provenance;
  /** Null = no validated observation; 0 is an explicitly observed zero. */
  observedCount: number | null;
}>;
export type R05GraphEdge = Readonly<{
  key: string;
  kind: R05EdgeKind;
  source: string;
  target: string;
  count: number | null;
  provenance: R05Provenance;
  /** Explicit source comment IDs from G2-O, never raw comments or proof of authenticity. */
  evidenceCommentIds: readonly string[] | null;
}>;
export type R05GraphProjection = Readonly<{
  schema: typeof R05_GRAPH_PROJECTION_SCHEMA;
  nodes: readonly R05GraphNode[];
  edges: readonly R05GraphEdge[];
  rejected: Readonly<{
    targets: number;
    groups: number;
    search: number;
    snapshots: number;
    expressions: number;
    scope: number;
  }>;
}>;

export type R05ObservationScope = Readonly<{
  id: string; // session-local, never an account or credential identifier
  keyword: string; // user-authored, 1–100 Unicode code points
  sourceKind: R05SourceKind;
  status: R05SourceStatus;
  startDay: string; // UTC calendar day, inclusive
  endDay: string; // UTC calendar day, inclusive
  periodTotal: number; // observed comments IN window for selected source
}>;
export type R05SearchResult = Readonly<{
  source: "YOUTUBE_API_SEARCH";
  keyword: string;
  fetchedAt: string;
  videos: readonly Readonly<{
    videoId: string;
    channelId: string | null;
    videoTitle: string | null;
    channelTitle: string | null;
  }>[];
}>;
export type R05VideoSample = Readonly<{
  snapshotId: string;
  sourceKind: R05SourceKind;
  videoId: string;
  status: R05SourceStatus;
  fetchedAt: string;
  fetchedCount: number;
  periodCount: number;
}>;
export type R05ObservedExpression = Readonly<{
  term: string;
  sourceKind: R05SourceKind;
  cooccurringComments: number;
  /** A bounded set of source IDs supplied by a verified calling adapter. */
  evidenceCommentIds: readonly string[];
}>;
export type R05GraphProjectionInput = Readonly<{
  registeredTargets: readonly WorkspaceUrlTarget[];
  groups?: readonly WorkspaceNodeGroup[];
  scope: R05ObservationScope | null;
  search?: R05SearchResult | null;
  samples?: readonly R05VideoSample[];
  expressions?: readonly R05ObservedExpression[];
}>;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const SCOPE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const EVIDENCE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const GROUP_ID = /^group-([1-9]|[12]\d|3[0-2])$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const VALID_SOURCE = new Set<R05SourceKind>([
  "USER_CSV_UNVERIFIED", "YOUTUBE_API_FIRST_PAGE_PUBLIC", "SYNTHETIC_FIXTURE",
]);
const VALID_STATUS = new Set<R05SourceStatus>([
  "READY", "PARTIAL", "STALE", "NO_DATA", "POLICY_BLOCKED", "FAILED",
]);
const quantitative = (status: R05SourceStatus): boolean =>
  status === "READY" || status === "PARTIAL";
const integer = (value: number, min = 0): boolean =>
  Number.isSafeInteger(value) && value >= min;
const isUtcTime = (input: string): boolean =>
  typeof input === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input) &&
  Number.isFinite(Date.parse(input)) &&
  new Date(input).toISOString().slice(0, 19) === input.slice(0, 19);
function utcDay(day: string): number | null {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const time = Date.parse(day + "T00:00:00Z");
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === day ? time : null;
}
function normalizePhrase(value: string, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().normalize("NFKC").replace(/\s+/g, " ");
  return cleaned.length > 0 && Array.from(cleaned).length <= max &&
    !CONTROL.test(cleaned) ? cleaned : null;
}
function safeLabel(value: string | null, fallback: string): string {
  const parsed = typeof value === "string" ? normalizePhrase(value, 120) : null;
  return parsed ?? fallback;
}
function key(kind: R05NodeKind, id: string): string {
  return kind + ":" + encodeURIComponent(id);
}
function edgeKey(kind: R05EdgeKind, a: string, b: string, suffix = ""): string {
  return kind + ":" + encodeURIComponent(a) + ":" +
    encodeURIComponent(b) + ":" + encodeURIComponent(suffix);
}
const provenance = (
  kind: R05Provenance["kind"], scopeId: string | null,
  snapshotId: string | null = null,
): R05Provenance => ({ kind, scopeId, snapshotId });

function validScope(input: R05ObservationScope | null): input is R05ObservationScope {
  if (!input || !SCOPE_ID.test(input.id) ||
      !normalizePhrase(input.keyword, 100) ||
      !VALID_SOURCE.has(input.sourceKind) || !VALID_STATUS.has(input.status) ||
      !integer(input.periodTotal) || input.periodTotal > 5000) return false;
  const start = utcDay(input.startDay);
  const end = utcDay(input.endDay);
  return start !== null && end !== null && end >= start &&
    end - start <= 89 * 86_400_000;
}

/**
 * No URL fetching, API key handling, storage, clock reads, global state or
 * automatic content discovery. For actual backend inputs, validate the
 * transport/provenance upstream; TS types alone cannot authenticate evidence.
 */
export function buildR05GraphProjection(input: R05GraphProjectionInput): R05GraphProjection {
  const nodes = new Map<string, R05GraphNode>();
  const edges = new Map<string, R05GraphEdge>();
  const rejected = { targets: 0, groups: 0, search: 0,
    snapshots: 0, expressions: 0, scope: 0 };
  const addNode = (value: R05GraphNode) => {
    if (!nodes.has(value.key)) nodes.set(value.key, value);
  };
  const addEdge = (kind: R05EdgeKind, source: string, target: string,
    count: number | null, sourceRef: R05Provenance,
    evidenceCommentIds: readonly string[] | null = null) => {
    if (!nodes.has(source) || !nodes.has(target) || source === target) return;
    const id = edgeKey(kind, source, target, sourceRef.snapshotId ?? sourceRef.scopeId ?? "");
    if (!edges.has(id)) edges.set(id, {
      key: id, kind, source, target, count, provenance: sourceRef,
      evidenceCommentIds: evidenceCommentIds === null ? null : [...evidenceCommentIds],
    });
  };
  const acceptedTargets = new Map<string, WorkspaceUrlTarget>();
  for (const [index, target] of input.registeredTargets.entries()) {
    if (index >= WORKSPACE_MAX_URL_TARGETS) {
      rejected.targets++;
      continue;
    }
    const parsed = parseWorkspaceYouTubeUrl(target.canonicalUrl);
    if (!parsed || parsed.kind !== target.kind || parsed.id !== target.id ||
        parsed.canonicalUrl !== target.canonicalUrl ||
        !integer(target.addedAt)) {
      rejected.targets++;
      continue;
    }
    const legacyKey = workspaceUrlTargetKey(target);
    if (acceptedTargets.has(legacyKey)) { rejected.targets++; continue; }
    acceptedTargets.set(legacyKey, target);
    addNode({
      key: legacyKey,
      kind: target.kind === "CHANNEL_HANDLE" ? "CHANNEL_HANDLE_CANDIDATE" : target.kind,
      label: target.kind === "VIDEO" ? "영상 제목 미확인" :
        target.kind === "CHANNEL" ? "채널 이름 미확인" : target.id,
      status: "UNVERIFIED",
      provenance: provenance("UNVERIFIED_URL", null),
      observedCount: null,
    });
  }

  const groupSeen = new Set<string>();
  const memberSeen = new Set<string>();
  const groups = input.groups ?? [];
  for (const [index, group] of groups.entries()) {
    const groupMembers = group.memberKeys;
    if (index >= WORKSPACE_MAX_NODE_GROUPS || !GROUP_ID.test(group.id) ||
        groupSeen.has(group.id) ||
        !normalizePhrase(group.name, 40) ||
        groupMembers.length < 2 || groupMembers.length > WORKSPACE_MAX_GROUP_MEMBERS ||
        new Set(groupMembers).size !== groupMembers.length ||
        groupMembers.some(member => !acceptedTargets.has(member) || memberSeen.has(member))) {
      rejected.groups++;
      continue;
    }
    groupSeen.add(group.id);
    groupMembers.forEach(member => memberSeen.add(member));
    const groupKey = key("GROUP", group.id);
    addNode({
      key: groupKey, kind: "GROUP", label: group.name, status: "USER_SELECTED",
      provenance: provenance("USER_GROUP", null), observedCount: null,
    });
    for (const member of groupMembers)
      addEdge("USER_GROUP_MEMBERSHIP", groupKey, member, null,
        provenance("USER_GROUP", null));
  }

  if (input.scope === null) {
    if (input.search) rejected.search += input.search.videos.length || 1;
    rejected.snapshots += input.samples?.length ?? 0;
    rejected.expressions += input.expressions?.length ?? 0;
    return { schema: R05_GRAPH_PROJECTION_SCHEMA,
      nodes: [...nodes.values()], edges: [...edges.values()], rejected };
  }
  if (!validScope(input.scope)) {
    rejected.scope = 1;
    rejected.search += input.search?.videos.length ?? 0;
    rejected.snapshots += input.samples?.length ?? 0;
    rejected.expressions += input.expressions?.length ?? 0;
    return { schema: R05_GRAPH_PROJECTION_SCHEMA,
      nodes: [...nodes.values()], edges: [...edges.values()], rejected };
  }
  const scope = input.scope;
  const keyword = normalizePhrase(scope.keyword, 100)!;
  const scopeRef = provenance(scope.sourceKind, scope.id);
  const keywordKey = key("KEYWORD", scope.id + ":" + keyword.toLocaleLowerCase());
  addNode({
    key: keywordKey, kind: "KEYWORD", label: keyword,
    status: "USER_SELECTED", provenance: provenance("USER_INPUT", scope.id),
    observedCount: null,
  });

  // A search-result relation is not a comment trend or a popularity claim.
  const search = input.search;
  if (search) {
    if (search.source !== "YOUTUBE_API_SEARCH" ||
        normalizePhrase(search.keyword, 100)?.toLocaleLowerCase() !==
          keyword.toLocaleLowerCase() ||
        !isUtcTime(search.fetchedAt) ||
        search.videos.length > R05_MAX_SEARCH_VIDEOS) {
      rejected.search += search.videos.length || 1;
    } else {
      const seenVideos = new Set<string>();
      for (const video of search.videos) {
        if (!VIDEO_ID.test(video.videoId) || seenVideos.has(video.videoId)) {
          rejected.search++;
          continue;
        }
        seenVideos.add(video.videoId);
        const videoKey = key("VIDEO", video.videoId);
        const currentVideo = nodes.get(videoKey);
        nodes.set(videoKey, {
          key: videoKey, kind: "VIDEO",
          label: safeLabel(video.videoTitle, currentVideo?.label ?? "영상 제목 미확인"),
          status: "SEARCH_CANDIDATE",
          provenance: provenance("YOUTUBE_API_SEARCH", scope.id),
          observedCount: null,
        });
        const searchRef = provenance("YOUTUBE_API_SEARCH", scope.id);
        addEdge("RETURNED_BY_SEARCH", keywordKey, videoKey, null, searchRef);
        if (video.channelId !== null && CHANNEL_ID.test(video.channelId)) {
          const channelKey = key("CHANNEL", video.channelId);
          const currentChannel = nodes.get(channelKey);
          nodes.set(channelKey, {
            key: channelKey, kind: "CHANNEL",
            label: safeLabel(video.channelTitle,
              currentChannel?.label ?? "채널 이름 미확인"),
            status: "SEARCH_CANDIDATE",
            provenance: searchRef,
            observedCount: null,
          });
          // Only the explicitly supplied official search membership creates an
          // ownership edge: never infer from video title or an unresolved @handle.
          addEdge("CHANNEL_PUBLISHES_VIDEO", channelKey, videoKey, null, searchRef);
        }
      }
    }
  }

  const validSamples = new Set<string>();
  const seenVideos = new Set<string>();
  const samples = input.samples ?? [];
  for (const [index, sample] of samples.entries()) {
    const inStatus = VALID_STATUS.has(sample.status);
    const knownCount = integer(sample.fetchedCount) && integer(sample.periodCount) &&
      sample.periodCount <= sample.fetchedCount &&
      sample.periodCount <= scope.periodTotal &&
      (sample.sourceKind !== "YOUTUBE_API_FIRST_PAGE_PUBLIC" ||
        sample.fetchedCount <= 100);
    if (index >= R05_MAX_SAMPLE_SNAPSHOTS || !SCOPE_ID.test(sample.snapshotId) ||
        !VIDEO_ID.test(sample.videoId) || sample.sourceKind !== scope.sourceKind ||
        !VALID_SOURCE.has(sample.sourceKind) || !inStatus ||
        !isUtcTime(sample.fetchedAt) || !knownCount ||
        validSamples.has(sample.snapshotId) || seenVideos.has(sample.videoId)) {
      rejected.snapshots++;
      continue;
    }
    validSamples.add(sample.snapshotId);
    seenVideos.add(sample.videoId);
    const videoKey = key("VIDEO", sample.videoId);
    addNode({
      key: videoKey, kind: "VIDEO", label: "영상 제목 미확인",
      status: "UNVERIFIED", provenance: scopeRef, observedCount: null,
    });
    const evidenceKey = key("EVIDENCE_SET", scope.id + ":" + sample.snapshotId);
    const canCount = quantitative(scope.status) && quantitative(sample.status);
    const sampleRef = provenance(scope.sourceKind, scope.id, sample.snapshotId);
    addNode({
      key: evidenceKey, kind: "EVIDENCE_SET",
      label: canCount ? "선택 표본 · 기간 내 " + sample.periodCount + "건" :
        "댓글 표본 미확인 · " + sample.status,
      status: canCount ? sample.status : sample.status === "READY" ? scope.status : sample.status,
      provenance: sampleRef,
      observedCount: canCount ? sample.periodCount : null,
    });
    if (canCount)
      addEdge("VIDEO_HAS_SAMPLE", videoKey, evidenceKey, sample.periodCount, sampleRef);
  }

  const expressions = input.expressions ?? [];
  const seenTerms = new Set<string>();
  for (const [index, expression] of expressions.entries()) {
    const term = normalizePhrase(expression.term, 40);
    const termLower = term?.toLocaleLowerCase() ?? "";
    if (index >= R05_MAX_EXPRESSIONS || !quantitative(scope.status) ||
        expression.sourceKind !== scope.sourceKind || !term ||
        termLower === keyword.toLocaleLowerCase() ||
        seenTerms.has(termLower) || !integer(expression.cooccurringComments, 1) ||
        expression.cooccurringComments > scope.periodTotal ||
        !Array.isArray(expression.evidenceCommentIds) ||
        expression.evidenceCommentIds.length === 0 ||
        expression.evidenceCommentIds.length > 2 ||
        expression.evidenceCommentIds.length > expression.cooccurringComments ||
        expression.evidenceCommentIds.some(id => !EVIDENCE_ID.test(id)) ||
        new Set(expression.evidenceCommentIds).size !== expression.evidenceCommentIds.length) {
      rejected.expressions++;
      continue;
    }
    seenTerms.add(termLower);
    const exprKey = key("EXPRESSION", scope.id + ":" + termLower);
    addNode({
      key: exprKey, kind: "EXPRESSION", label: term!,
      status: scope.status, provenance: scopeRef,
      observedCount: expression.cooccurringComments,
    });
    addEdge("LEXICAL_COOCCURRENCE", keywordKey, exprKey,
      expression.cooccurringComments, scopeRef, expression.evidenceCommentIds);
  }

  return {
    schema: R05_GRAPH_PROJECTION_SCHEMA,
    nodes: [...nodes.values()], edges: [...edges.values()], rejected,
  };
}
