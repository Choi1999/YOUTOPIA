import {
  channelIdentityText,
  channelProfileForTarget,
  type ApprovedChannelProfileCache,
  type ChannelProfileView,
} from "./workspaceChannelProfile";
import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";

/**
 * Explicit distinction between a pasted identifier and a verified channel.
 * A visually distinct local identicon is not the creator's real avatar.
 */
export function WorkspaceChannelIdentity({
  target,
  profiles,
  compact = false,
}: Readonly<{
  target: WorkspaceUrlTarget;
  profiles?: ApprovedChannelProfileCache;
  compact?: boolean;
}>) {
  const identity: ChannelProfileView | null =
    profiles?.get(target) ?? channelProfileForTarget(target);
  if (!identity) return null;

  return (
    <span className={
      "workspace-channel-identity" +
      (compact ? " workspace-channel-identity--compact" : "")
    } data-channel-identity={identity.identity}
      data-metadata-state={identity.status}>
      <span className="workspace-channel-identity__status">
        {channelIdentityText(identity)}
      </span>
      {identity.status === "READY" ? (
        <span className="workspace-channel-identity__verified">
          {identity.title} · {identity.channelId}
        </span>
      ) : (
        !compact && (
          <span className="workspace-channel-identity__pending">
            채널 정보가 아직 제공되지 않습니다.
          </span>
        )
      )}
    </span>
  );
}
