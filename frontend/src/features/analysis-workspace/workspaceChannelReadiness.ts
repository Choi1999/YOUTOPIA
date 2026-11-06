import policySnapshot from "../../../../shared/contracts/yu32-youtube-readiness-v0/policy-gates.json";
import {planOfflineChannelMetadata} from "./workspaceChannelPreflight";
import type {WorkspaceUrlTarget} from "./workspaceUrlTargets";

/**
 * UI-R04-H — offline evidence/readiness assessment, NOT a permission grant.
 * The imported source is a repository policy snapshot, NOT live Google Cloud.
 * No key, token, service-account record, provider adapter, fetch or API
 * request can be supplied through this module or the user-facing UI.
 */
export const READINESS_RUNTIME_GATE = "POLICY_HOLD" as const;
export const READINESS_LIVE_CALL_AUTHORIZED = false as const;

export const READINESS_REQUIREMENTS = [
  {
    id:"Y45-E01", title:"Google Cloud 프로젝트 소유권",
    expected:"현재 프로젝트와 담당 계정의 소유권·프로젝트 ID를 공식 콘솔 증거로 확인",
  },
  {
    id:"Y45-E02", title:"YouTube Data API 사용 설정",
    expected:"대상 프로젝트에서 API 활성화 여부 및 지원 인증 방식 확인",
  },
  {
    id:"Y45-E03", title:"서버 측 인증정보 보호",
    expected:"YouTube Data API 제한, 서버 출발지 제한, 비밀 저장·회전·로그 마스킹 증거",
  },
  {
    id:"Y45-E04", title:"실제 API 할당량·요청 상한",
    expected:"Cloud Console 실잔여 할당량·프로젝트 제한·백오프 및 호출 비용 상한",
  },
  {
    id:"Y45-E05", title:"YouTube API 정책·이용 조건",
    expected:"공개 메타데이터 조회 용도·표시·보존·삭제에 대한 정책 검토 승인",
  },
  {
    id:"Y45-E09", title:"서버 접근·테넌트 격리",
    expected:"서버 AuthN·테넌트 권한·CSRF·BOLA 및 읽기 전용 전송 경계",
  },
  {
    id:"Y45-E11", title:"첫 실제 조회 승인",
    expected:"정확한 대상·운영자·시각·API method·최대 1회·최대 1단위 승인",
  },
  {
    id:"Y45-E12", title:"보안·개인정보·비용 승인",
    expected:"운영·보안·개인정보·비용·배포 책임자의 서명된 별도 승인",
  },
] as const;

type EvidenceStatus =
  "UNVERIFIED" | "POLICY_HOLD" | "NOT_APPROVED" |
  "NOT_IMPLEMENTED" | "SOURCE_INVALID";

export type ChannelReadinessGate = Readonly<{
  id: typeof READINESS_REQUIREMENTS[number]["id"];
  title: string;
  evidenceStatus: EvidenceStatus;
  evidenceNeeded: string;
}>;

export type ProposedFirstChannelRead = Readonly<{
  method: "channels.list";
  part: "snippet";
  filter: "id" | "forHandle";
  targetId: string;
  maxCalls: 1;
  maxUnits: 1;
  operator: "UNASSIGNED";
  approval: "NOT_APPROVED";
  executable: false;
}>;

export type ChannelReadinessAssessment = Readonly<{
  mode: "REPOSITORY_EVIDENCE_REVIEW";
  decision: "BLOCKED";
  policyGate: "POLICY_HOLD";
  liveCallsAuthorized: false;
  networkExecuted: false;
  policyDocument: string;
  sourceReviewedOn: string | null;
  sourceValid: boolean;
  verifiedGates: 0;
  requiredGates: number;
  gates: readonly ChannelReadinessGate[];
  firstCall: ProposedFirstChannelRead | null;
  cloudAccountVerified: false;
  actualQuotaVerified: false;
  credentialsInspected: false;
}>;

const POLICY_DOCUMENT =
  "shared/contracts/yu32-youtube-readiness-v0/policy-gates.json";
const STATUS=new Set<EvidenceStatus>([
  "UNVERIFIED","POLICY_HOLD","NOT_APPROVED","NOT_IMPLEMENTED",
]);

function object(raw: unknown): raw is Record<string,unknown> {
  return typeof raw==="object" && raw!==null && !Array.isArray(raw);
}

/**
 * All required gate IDs must be present exactly once. Even if a future
 * policy file reports that live calls were authorized, this UI remains
 * BLOCKED until a separately reviewed runtime capability is implemented.
 * Unexpected format, status or values => SOURCE_INVALID, never ready.
 */
function readPolicy(raw:unknown): {
  reviewedOn:string;
  statuses:ReadonlyMap<string,EvidenceStatus>;
} | null {
  if(!object(raw) ||
    raw.contractVersion!=="YU32_G4_5_PROVIDER_GATES_V01" ||
    raw.status!=="POLICY_HOLD" ||
    raw.liveCallsAuthorized!==false ||
    raw.verifiedCount!==0 ||
    raw.externalDataCollected!==false ||
    raw.derivedSentimentAuthorized!==false ||
    typeof raw.reviewedOn!=="string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.reviewedOn) ||
    !Array.isArray(raw.evidence) || raw.evidence.length>50) return null;

  const statuses=new Map<string,EvidenceStatus>();
  for(const item of raw.evidence) {
    if(!object(item) || typeof item.id!=="string" ||
      typeof item.status!=="string" ||
      !STATUS.has(item.status as EvidenceStatus) ||
      typeof item.need!=="string" || typeof item.gate!=="string" ||
      statuses.has(item.id)) return null;
    statuses.set(item.id,item.status as EvidenceStatus);
  }
  if(!READINESS_REQUIREMENTS.every(item=>statuses.has(item.id)))
    return null;
  return {reviewedOn:raw.reviewedOn,statuses};
}

/** Quota estimates are proposals only; a target is never auto-approved. */
function proposedFirstCall(targets:readonly WorkspaceUrlTarget[]): ProposedFirstChannelRead | null {
  const report=planOfflineChannelMetadata(targets);
  if(report.budgetStatus==="INVALID_INPUT" || report.operations.length===0)
    return null;
  const first=report.operations[0];
  const value=first.values[0];
  if (!value) return null;
  return {
    method:"channels.list",part:"snippet",
    filter:first.filter,targetId:value,
    maxCalls:1,maxUnits:1,
    operator:"UNASSIGNED",approval:"NOT_APPROVED",executable:false,
  };
}

export function assessChannelReadiness(
  targets: readonly WorkspaceUrlTarget[],
  policy: unknown = policySnapshot,
): ChannelReadinessAssessment {
  const valid=readPolicy(policy);
  const gates=READINESS_REQUIREMENTS.map(requirement=>({
    id:requirement.id,
    title:requirement.title,
    evidenceStatus:valid?.statuses.get(requirement.id) ?? "SOURCE_INVALID",
    evidenceNeeded:requirement.expected,
  }));
  return {
    mode:"REPOSITORY_EVIDENCE_REVIEW",
    decision:"BLOCKED",
    policyGate:READINESS_RUNTIME_GATE,
    liveCallsAuthorized:READINESS_LIVE_CALL_AUTHORIZED,
    networkExecuted:false,
    policyDocument:POLICY_DOCUMENT,
    sourceReviewedOn:valid?.reviewedOn ?? null,
    sourceValid:Boolean(valid),
    verifiedGates:0,
    requiredGates:READINESS_REQUIREMENTS.length,
    gates,
    firstCall:proposedFirstCall(targets),
    cloudAccountVerified:false,
    actualQuotaVerified:false,
    credentialsInspected:false,
  };
}
