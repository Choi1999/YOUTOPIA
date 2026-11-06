import type { WorkspaceUrlTarget } from "./workspaceUrlTargets";
import {
  ApprovedChannelProfileCache,
  channelProfileForTarget,
  validateApprovedChannelProfile,
  type ChannelProfileView,
} from "./workspaceChannelProfile";

/**
 * UI-R04-F: read-only metadata adapter boundary, deliberately NOT wired to
 * any runtime YouTube client. It cannot bypass G45's first live-call gate.
 *
 * allowRead must remain false until the provider read policy and
 * credentials, quotas, retention and safe transport are reviewed separately.
 */
export const CHANNEL_METADATA_RUNTIME_GATE = "POLICY_HOLD" as const;

export type ApprovedReadOnlyChannelReader = (
  target: Pick<WorkspaceUrlTarget, "kind" | "id">,
) => Promise<unknown>;

type ChannelTarget = Pick<WorkspaceUrlTarget, "kind" | "id">;

function failed(
  target: ChannelTarget,
  status: "NOT_FOUND" | "FAILED",
): ChannelProfileView | null {
  const fallback = channelProfileForTarget(target);
  return fallback && {
    ...fallback,
    status,
    thumbnailUrl:null,
    title:null,
  };
}

/**
 * The real application only exports POLICY_HOLD; test-only injected readers
 * can prove future matching, failure and cache behavior without networking.
 * Use the caller's explicit allowRead AND a provided reader as dual gates.
 */
export async function readChannelProfileWithGate(
  target: ChannelTarget,
  cache: ApprovedChannelProfileCache,
  options: Readonly<{
    allowRead: boolean;
    reader?: ApprovedReadOnlyChannelReader;
  }> = {allowRead:false},
  now = Date.now(),
): Promise<ChannelProfileView | null> {
  if (target.kind === "VIDEO") return null;
  if (!options.allowRead || !options.reader) {
    return channelProfileForTarget(target,null,now);
  }
  try {
    const raw = await options.reader(target);
    if (raw === null) return failed(target,"NOT_FOUND");
    const approved = validateApprovedChannelProfile(raw,now);
    if (!approved) return failed(target,"FAILED");
    const view = channelProfileForTarget(target,approved,now);
    if (view?.status !== "READY" || !cache.put(approved,now)) {
      return failed(target,"FAILED");
    }
    return view;
  } catch {
    return failed(target,"FAILED");
  }
}
