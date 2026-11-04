import { useState } from "react";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
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
}: Readonly<{
  target: TargetIdentity;
  variant: WorkspaceArtworkVariant;
  allowVideoImage?: boolean;
}>) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const candidate = optInVideoThumbnailSource(target, allowVideoImage);
  const source = candidate && failedSource !== candidate ? candidate : null;
  const fallback = target.kind === "VIDEO" ? "▶" : "◎";
  const hint = target.kind === "VIDEO"
    ? allowVideoImage
      ? "영상 이미지 미확인"
      : "영상 이미지 미리보기 비활성"
    : target.kind === "CHANNEL_HANDLE"
      ? "채널 핸들·프로필 미확인"
      : "채널 프로필 미조회";

  return (
    <span className={
      "workspace-target-artwork workspace-target-artwork--" + variant +
      " workspace-target-artwork--" +
      (target.kind === "VIDEO" ? "video" : "channel")
    } data-preview={source ? "requested" : "placeholder"}
      title={hint} aria-hidden="true">
      {source ? (
        <img src={source} alt="" decoding="async" loading="lazy"
          referrerPolicy="no-referrer" draggable={false}
          onError={() => setFailedSource(source)}/>
      ) : (
        <span className="workspace-target-artwork__fallback">{fallback}</span>
      )}
      {variant === "detail" && (
        <span className="workspace-target-artwork__caption">
          {source ? "외부 CDN 이미지 · 분석 데이터 아님" : hint}
        </span>
      )}
    </span>
  );
}
