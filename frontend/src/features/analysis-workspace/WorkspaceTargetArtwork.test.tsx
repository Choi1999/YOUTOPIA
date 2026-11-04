import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceTargetArtwork, optInVideoThumbnailSource } from "./WorkspaceTargetArtwork";

const VIDEO = {kind:"VIDEO" as const,id:"Ab0_-123xyz"};
const CHANNEL = {kind:"CHANNEL" as const,id:"UC"+"A".repeat(22)};
const HANDLE = {kind:"CHANNEL_HANDLE" as const,id:"@somecreator"};
const cdn = "https://i.ytimg.com/vi/Ab0_-123xyz/hqdefault.jpg";

describe("UI-R04-E — gated thumbnail artwork and fallback", () => {
  it("does not create any external image src before explicit opt-in", () => {
    expect(optInVideoThumbnailSource(VIDEO,false)).toBeNull();
    render(<WorkspaceTargetArtwork target={VIDEO} variant="node"/>);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("[data-preview=placeholder]")).toBeInTheDocument();
  });

  it("builds only canonical video CDN URLs after opt-in", () => {
    expect(optInVideoThumbnailSource(VIDEO,true)).toBe(cdn);
    expect(optInVideoThumbnailSource(CHANNEL,true)).toBeNull();
    expect(optInVideoThumbnailSource(HANDLE,true)).toBeNull();
    expect(optInVideoThumbnailSource({kind:"VIDEO",id:"../BAD"},true)).toBeNull();
    expect(optInVideoThumbnailSource({kind:"VIDEO",id:"Ab0_-123xyz?"},true)).toBeNull();
    render(<WorkspaceTargetArtwork target={VIDEO} variant="detail" allowVideoImage/>);
    const image = document.querySelector("img");
    expect(image).toHaveAttribute("src",cdn);
    expect(image).toHaveAttribute("referrerpolicy","no-referrer");
    expect(image).toHaveAttribute("loading","lazy");
    expect(screen.getByText(/분석 데이터 아님/)).toBeInTheDocument();
  });

  it("falls back to the original icon after an image fails", () => {
    render(<WorkspaceTargetArtwork target={VIDEO} variant="node" allowVideoImage/>);
    const image = document.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("[data-preview=placeholder]")).toBeInTheDocument();
  });

  it("never invents a profile URL from channel IDs or handles", () => {
    render(<>
      <WorkspaceTargetArtwork target={CHANNEL} variant="detail" allowVideoImage/>
      <WorkspaceTargetArtwork target={HANDLE} variant="list" allowVideoImage/>
    </>);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText("채널 프로필 미조회")).toBeInTheDocument();
  });
});
