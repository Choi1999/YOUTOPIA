import { useState } from "react";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import {
  channelProfileForTarget, isApprovedChannelThumbnailUrl,
  type ApprovedChannelProfileCache,
} from "./workspaceChannelProfile";
import { workspaceUrlTargetKey } from "./workspaceUrlTargets";
import {
  EMPTY_TARGET_PRESENTATION, type WorkspaceTargetPresentation,
} from "./workspaceTargetPresentation";
import { readyProviderMetadata } from "./workspaceProviderMetadata";
import "./workspace-artwork.css";

export type WorkspaceArtworkVariant = "node" | "card" | "list" | "detail";

type TargetIdentity = Pick<WorkspaceUrlTarget, "kind" | "id">;

/**
 * Video thumbnail CDN URL construction is deliberately independent from
 * AnalysisRepository, channel metadata, comments, collection workers,
 * and the first-real-API-call policy gate.
 *
 * The browser must not request this image until the user explicitly enables
 * external video image previews in the current in-memory page session.
 */
export function optInVideoThumbnailSource(
  target: TargetIdentity,
  userEnabled: boolean,
): string | null {
  if (!userEnabled || target.kind !== "VIDEO" ||
      !/^[A-Za-z0-9_-]{11}$/.test(target.id)) return null;
  return "https://i.ytimg.com/vi/" + target.id + "/hqdefault.jpg";
}

/**
 * Shared shape across graph, collection cards, list dock and detail dock.
 * CHANNEL and CHANNEL_HANDLE use a visibly unresolved avatar until a
 * separately approved, validated metadata source is available.
 *
 * A successful image load verifies only an image response, never video
 * existence, channel identity, ownership, audience, or analysis status.
 */
export function WorkspaceTargetArtwork({
  target,
  variant,
  allowVideoImage = false,
  allowChannelImage = false,
  presentation = EMPTY_TARGET_PRESENTATION,
  channelProfiles,
}: Readonly<{
  target: TargetIdentity;
  variant: WorkspaceArtworkVariant;
  allowVideoImage?: boolean;
  allowChannelImage?: boolean;
  presentation?: WorkspaceTargetPresentation;
  channelProfiles?: ApprovedChannelProfileCache;
}>) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const local = presentation.synthetic?.[workspaceUrlTargetKey(target)];
  const synthetic = local?.source === "LOCAL_SYNTHETIC_ONLY" &&
    local.kind === target.kind && local.requestedId === target.id &&
    local.sourceAuthenticated === false && local.providerRequestsMade === 0 &&
    local.consumerPublicationAuthorized === false;
  const provider = readyProviderMetadata(
    presentation.providerStates?.[workspaceUrlTargetKey(target)],target);
  const channelIdentity = channelProfiles?.get(target) ?? channelProfileForTarget(target);
  // A user-pasted image URL is not approved metadata or proof of identity.
  // Both paths are blocked from image loading until consent is enabled.
  const manuallySupplied = target.kind === "VIDEO"
    ? null : presentation.channelImages[workspaceUrlTargetKey(target)];
  const optionalManual = isApprovedChannelThumbnailUrl(manuallySupplied)
    ? manuallySupplied : null;
  const channelSource = allowChannelImage
    ? (channelIdentity?.status === "READY" && channelIdentity.thumbnailUrl)
      || provider?.thumbnailUrl || optionalManual
    : null;
  // Provider images also require the same independent opt-in as existing CDNs.
  // Default product route has no provider reader; no implicit network occurs.
  const candidate = synthetic ? null : target.kind === "VIDEO"
    ? allowVideoImage
      ? provider?.thumbnailUrl ?? optInVideoThumbnailSource(target,true)
      : null
    : channelSource;
  const source = candidate && failedSource !== candidate ? candidate : null;
  // Local visual identifiers only; do not mistake the initial for a real avatar.
  const fallback = target.kind === "VIDEO" ? "▶" :
    target.kind === "CHANNEL_HANDLE"
      ? target.id.slice(1,2).toUpperCase() : "C";
  const hint = synthetic ? "합성 썸네일 · 실제 YouTube 이미지 아님" :
    provider && source === provider.thumbnailUrl
      ? "백엔드 메타데이터 이미지 · 댓글 분석과 별개" :
    target.kind === "VIDEO"
    ? allowVideoImage
      ? "영상 이미지 미확인"
      : "영상 이미지 미리보기 비활성"
    : allowChannelImage && optionalManual && source === optionalManual
      ? "사용자 제공 채널 이미지 · 채널 일치 미확인"
      : channelIdentity?.status === "READY"
        ? "채널 메타데이터 검증됨 · 댓글 분석과 별개"
      : target.kind === "CHANNEL_HANDLE"
        ? "채널 핸들·프로필 미확인"
        : "채널 프로필 미조회";

  return (
    <span className={
      "workspace-target-artwork workspace-target-artwork--" + variant +
      " workspace-target-artwork--" +
      (target.kind === "VIDEO" ? "video" : "channel")
    } data-preview={synthetic ? "synthetic" : source ? "requested" : "placeholder"}
      data-channel-profile={channelIdentity?.status ?? "not-applicable"}
      title={hint} aria-hidden="true">
      {synthetic ? (
        <span className="workspace-target-artwork__synthetic">
          <span className="workspace-target-artwork__synthetic-icon">
            {target.kind === "VIDEO" ? "▶" : "C"}
          </span>
          <span className="workspace-target-artwork__synthetic-mark">DEMO</span>
        </span>
      ) : source ? (
        <img src={source} alt="" decoding="async" loading="lazy"
          referrerPolicy="no-referrer" draggable={false}
          onError={() => setFailedSource(source)}/>
      ) : (
        <span className="workspace-target-artwork__fallback">{fallback}</span>
      )}
      {variant === "detail" && (
        <span className="workspace-target-artwork__caption">
          {synthetic ? "합성 그래픽 · 실제 제공자 이미지 아님" :
            source ? "승인된 이미지 미리보기 · 분석 데이터 아님" : hint}
        </span>
      )}
    </span>
  );
}
