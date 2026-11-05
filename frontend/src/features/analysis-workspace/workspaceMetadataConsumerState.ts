/**
 * UI-R04-AA — versioned consumer metadata state contract, in-memory only.
 *
 * Every accepted server payload is test-only, unauthenticated and must have
 * providerRequestsMade=0. This is NOT a production YouTube verification path.
 * PENDING and IDLE are local client states, never a provider claim.
 */
import { workspaceUrlTargetKey, type WorkspaceUrlTarget } from "./workspaceUrlTargets";
import { simulateOfflineMetadataBackend, type SyntheticWorkspaceMetadata } from "./workspaceSyntheticMetadata";

export const STATE_SCHEMA = "YOUTOPIA_R04Z_METADATA_CONSUMER_STATE_V01" as const;
export type StateStatus = "IDLE" | "PENDING" | "READY" | "NOT_FOUND" | "FAILED" | "STALE";
export type StateScenario = "READY" | "NOT_FOUND" | "FAILED" | "STALE";

export type MetadataState = Readonly<{
  status: StateStatus;
  record: SyntheticWorkspaceMetadata | null;
  observedAt: number;
  expiresAt: number;
  reason: string | null;
  /** Non-provider fixture result never establishes channel ownership. */
  relationVerified: false;
}>;

const ZERO: MetadataState = {
  status:"IDLE",record:null,observedAt:0,expiresAt:0,reason:null,
  relationVerified:false,
};
export const EMPTY_METADATA_STATE = ZERO;

export function pendingMetadataState(): MetadataState {
  return {...ZERO,status:"PENDING"};
}

const ENVELOPE_KEYS = [
  "artwork","associationVerified","channelId","channelName",
  "consumerPublicationAuthorized","expiresAt","failureCode","kind",
  "observedAt","providerRequestsMade","requestedId","schema","source",
  "sourceAuthenticated","status","title",
].sort().join("|");
const CONTROL = /[\u0000-\u001f\u007f]/;
const FAILURE_CODE: Record<Exclude<StateScenario,"READY">,string> = {
  NOT_FOUND:"FIXTURE_NOT_FOUND",
  FAILED:"FIXTURE_UNAVAILABLE",
  STALE:"FIXTURE_EXPIRED",
};

function isSafeTitle(value:unknown):value is string {
  return typeof value==="string" && value.length>0 && value.length<=120 &&
    value===value.trim() && !CONTROL.test(value);
}

/** Strict shape + target binding. An untrusted payload can never mint trust. */
export function decodeMetadataState(
  raw:unknown,target:Pick<WorkspaceUrlTarget,"kind"|"id">,now=Date.now(),
): MetadataState | null {
  if (!Number.isSafeInteger(now) || now<0 ||
      !simulateOfflineMetadataBackend(target) ||
      raw===null || typeof raw!=="object" || Array.isArray(raw)) return null;
  const x=raw as Record<string,unknown>;
  if (Object.keys(x).sort().join("|")!==ENVELOPE_KEYS ||
      x.schema!==STATE_SCHEMA || x.source!=="LOCAL_SYNTHETIC_ONLY" ||
      x.kind!==target.kind || x.requestedId!==target.id ||
      x.sourceAuthenticated!==false || x.providerRequestsMade!==0 ||
      x.consumerPublicationAuthorized!==false ||
      x.associationVerified!==false || x.channelId!==null ||
      !["READY","NOT_FOUND","FAILED","STALE"].includes(x.status as string) ||
      typeof x.observedAt!=="number" || !Number.isSafeInteger(x.observedAt) ||
      typeof x.expiresAt!=="number" || !Number.isSafeInteger(x.expiresAt)) return null;
  const state=x.status as StateScenario;
  const hasRecord=state==="READY" || state==="STALE";
  if (!hasRecord) {
    if (x.title!==null || x.channelName!==null || x.artwork!==null ||
        x.observedAt!==0 || x.expiresAt!==0 ||
        x.failureCode!==FAILURE_CODE[state]) return null;
    return {status:state,record:null,observedAt:0,expiresAt:0,
      reason:x.failureCode as string,relationVerified:false};
  }
  if (!isSafeTitle(x.title) ||
      (target.kind==="VIDEO"
        ? !isSafeTitle(x.channelName)
        : x.channelName!==null) ||
      x.artwork!==(target.kind==="VIDEO"?"VIDEO_PLACEHOLDER":"CHANNEL_PLACEHOLDER") ||
      x.observedAt<=0 || x.expiresAt<=x.observedAt ||
      x.observedAt>now+30_000 ||
      (state==="READY"
        ? x.expiresAt<=now || x.expiresAt-now>15*60_000 ||
          x.failureCode!==null
        : x.expiresAt>now || x.failureCode!=="FIXTURE_EXPIRED")) return null;

  const record:SyntheticWorkspaceMetadata={
    source:"LOCAL_SYNTHETIC_ONLY",
    kind:target.kind,requestedId:target.id,title:x.title,
    channelName:x.channelName as string|null,
    artwork:x.artwork,
    sourceAuthenticated:false,providerRequestsMade:0,
    consumerPublicationAuthorized:false,
  };
  // STALE content is retained ONLY for diagnostic identity, never published.
  return {status:state,record:state==="READY"?record:null,
    observedAt:x.observedAt,expiresAt:x.expiresAt,
    reason:state==="STALE"?"FIXTURE_EXPIRED":null,relationVerified:false};
}

export function metadataStateLabel(state:MetadataState|undefined):string {
  switch(state?.status ?? "IDLE") {
    case "PENDING": return "합성 조회 대기 중";
    case "READY": return "합성 정보 준비됨 · 실제 제공자 미확인";
    case "NOT_FOUND": return "합성 미존재 사례 · 실제 영상 존재 여부 미확인";
    case "FAILED": return "합성 조회 오류 · 데이터 미표시";
    case "STALE": return "합성 정보 만료 · 다시 조회 필요";
    default: return "메타데이터 미조회";
  }
}

/**
 * Cache may store ONLY validated READY results, max 32 entries, max 15min TTL.
 * Expired results never become READY or a verified channel association.
 */
export class InMemoryMetadataStateCache {
  private readonly records=new Map<string, MetadataState>();
  readonly limit=32;

  get(target:Pick<WorkspaceUrlTarget,"kind"|"id">,now=Date.now()):
      MetadataState | null {
    const key=workspaceUrlTargetKey(target);
    const found=this.records.get(key);
    if (!found) return null;
    if (found.status!=="READY" || now>=found.expiresAt) {
      this.records.delete(key);
      return {...ZERO,status:"STALE",reason:"CACHE_EXPIRED"};
    }
    this.records.delete(key);
    this.records.set(key,found);
    return found;
  }

  put(target:Pick<WorkspaceUrlTarget,"kind"|"id">,value:MetadataState):boolean {
    if (value.status!=="READY" || !value.record ||
        value.record.kind!==target.kind || value.record.requestedId!==target.id ||
        value.record.sourceAuthenticated!==false ||
        value.record.providerRequestsMade!==0 ||
        value.record.consumerPublicationAuthorized!==false ||
        value.relationVerified!==false || value.expiresAt<=Date.now()) return false;
    const key=workspaceUrlTargetKey(target);
    this.records.delete(key);
    this.records.set(key,value);
    while(this.records.size>this.limit) {
      const first=this.records.keys().next().value;
      if (first===undefined) break;
      this.records.delete(first);
    }
    return true;
  }

  invalidate(target:Pick<WorkspaceUrlTarget,"kind"|"id">):void {
    this.records.delete(workspaceUrlTargetKey(target));
  }
  clear():void {this.records.clear();}
  size():number{return this.records.size;}
}

/**
 * No synthetic relation may claim ownership, even if a VIDEO id and CHANNEL
 * id both happen to be registered. A real provider contract would require a
 * separately reviewed authenticated provenance and exact canonical linkage.
 */
export function verifiedVideoChannelRelation(
  video:MetadataState, channel:MetadataState,
):false {
  void video; void channel;
  return false;
}
