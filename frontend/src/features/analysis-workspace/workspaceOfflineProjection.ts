import {
  importKeywordCsv, inspectKeyword, userKeyword,
  MAX_CSV_BYTES, type Observation, type TrendWindow,
} from "../trend/userKeywordTrend";
import { discoverObservedExpressions } from "../trend/observedExpressionCandidates";
import {
  buildR05GraphProjection,
  type R05GraphProjection,
  type R05SourceKind,
  type R05VideoSample,
} from "./workspaceGraphProjection";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import type { WorkspaceNodeGroup } from "./workspaceNodeGroups";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const DAY_MS = 86_400_000;
export const R05_OFFLINE_MAX_VIDEO_IDS = 3;

/** Fully labeled, explicitly selected example. Never passed off as YouTube data. */
export const R05_SYNTHETIC_CSV = [
  "comment_id,video_id,channel_id,published_at,text,video_title,channel_name",
  "demo1,AbCdefghI12,UCaaaaaaaaaaaaaaaaaaaaaa,2026-11-08T09:00:00Z,음악 노래 플레이리스트,합성 영상 A,합성 채널",
  "demo2,AbCdefghI12,UCaaaaaaaaaaaaaaaaaaaaaa,2026-11-09T09:00:00Z,음악 노래 추천,합성 영상 A,합성 채널",
  "demo3,Qb0_-123xyz,UCbbbbbbbbbbbbbbbbbbbbbb,2026-11-09T10:00:00Z,노래 좋다,합성 영상 B,합성 채널 B",
  "demo4,Qb0_-123xyz,UCbbbbbbbbbbbbbbbbbbbbbb,2026-11-09T11:00:00Z,음악 감상,합성 영상 B,합성 채널 B",
].join("\n");

export type R05OfflineProjectionResult =
  | Readonly<{ kind: "INVALID"; message: string }>
  | Readonly<{
      kind: "READY";
      projection: R05GraphProjection;
      sourceKind: "USER_CSV_UNVERIFIED" | "SYNTHETIC_FIXTURE";
      importedAt: string;
      keyword: string;
      period: TrendWindow;
      startDay: string;
      endDay: string;
      periodTotal: number;
      primaryMatches: number;
      observations: readonly Observation[];
      labels: Readonly<Record<string, string>>;
    }>;

function fail(message: string): R05OfflineProjectionResult {
  return {kind:"INVALID",message};
}
function validUtc(input: string): boolean {
  if (typeof input !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input)) return false;
  const date = Date.parse(input);
  return Number.isFinite(date) &&
    new Date(date).toISOString().slice(0,19) === input.slice(0,19);
}
const utcDay = (date: string) => new Date(date).toISOString().slice(0,10);

/**
 * Explicitly selected text only. Never fetches, persists, or changes R04
 * target registration. CSV content is not an authenticated YouTube source.
 */
export function createR05OfflineProjection(
  csvText: string,
  rawKeyword: string,
  period: TrendWindow,
  sourceKind: "USER_CSV_UNVERIFIED" | "SYNTHETIC_FIXTURE",
  importedAt: string,
  scopeId: string,
  registeredTargets: readonly WorkspaceUrlTarget[],
  groups: readonly WorkspaceNodeGroup[],
): R05OfflineProjectionResult {
  if (typeof csvText !== "string" || csvText.length > MAX_CSV_BYTES ||
      !validUtc(importedAt) || !/^[A-Za-z0-9_-]{1,64}$/.test(scopeId)) {
    return fail("CSV 크기·표본 시각·세션 식별자를 확인하세요.");
  }
  if (sourceKind !== "USER_CSV_UNVERIFIED" && sourceKind !== "SYNTHETIC_FIXTURE") {
    return fail("허용되지 않은 오프라인 데이터 출처입니다.");
  }
  const keyword = userKeyword(rawKeyword);
  if (!keyword || ![7,30,90].includes(period))
    return fail("1~100자의 키워드와 올바른 관측 기간을 선택하세요.");
  const parsed = importKeywordCsv(csvText);
  if (parsed.kind !== "READY") return fail(parsed.reason);
  const observations = parsed.observations;
  const videoIds = [...new Set(observations.map(x=>x.videoId))];
  if (!videoIds.length || videoIds.length > R05_OFFLINE_MAX_VIDEO_IDS ||
      videoIds.some(id=>!VIDEO_ID.test(id))) {
    return fail("오프라인 그래프는 올바른 11자 영상 ID 최대 3개만 지원합니다.");
  }
  const trend = inspectKeyword(keyword, observations, period);
  if (trend.kind !== "READY") return fail("선택 기간의 관측 댓글을 확인할 수 없습니다.");
  const matched = discoverObservedExpressions(keyword, observations, period);
  if (matched.kind !== "READY") return fail("관측 후보 분석 범위를 확인할 수 없습니다.");

  const start=Date.parse(trend.startDay+"T00:00:00Z");
  const end=Date.parse(trend.endDay+"T00:00:00Z")+DAY_MS;
  const inWindow = observations.filter(x=>{
    const t=Date.parse(x.publishedAt);
    return Number.isFinite(t)&&t>=start&&t<end;
  });
  const sampleKind:R05SourceKind=sourceKind;
  const samples:R05VideoSample[] = videoIds.map((id,i)=>({
    snapshotId:"local-"+(i+1),
    sourceKind:sampleKind,
    videoId:id,
    status:"READY",
    fetchedAt:importedAt,
    fetchedCount:observations.filter(x=>x.videoId===id).length,
    periodCount:inWindow.filter(x=>x.videoId===id).length,
  }));
  const projection = buildR05GraphProjection({
    registeredTargets,
    groups,
    scope:{
      id:scopeId, keyword, sourceKind, status:"READY",
      startDay:trend.startDay,endDay:trend.endDay,periodTotal:trend.total,
    },
    // CSV does not authenticate official search membership or channel ownership.
    search:null,
    samples,
    expressions:matched.candidates.map(candidate=>({
      term:candidate.term,
      sourceKind,
      cooccurringComments:candidate.cooccurringComments,
      evidenceCommentIds:candidate.evidence.map(item=>item.commentId),
    })),
  });
  const labels: Record<string,string> = {};
  for(const x of observations) {
    const id="VIDEO:"+x.videoId;
    // These labels originate from an unverified CSV / explicitly synthetic
    // data, so UI must disclose provenance rather than claim official titles.
    if(!labels[id]) labels[id]=x.videoTitle||"영상 제목 미확인";
  }
  return {
    kind:"READY", projection, sourceKind, importedAt,
    keyword,period,startDay:trend.startDay,endDay:trend.endDay,
    periodTotal:trend.total,primaryMatches:trend.matches,
    observations,labels,
  };
}
