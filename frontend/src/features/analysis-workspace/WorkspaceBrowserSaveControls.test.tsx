import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceBrowserSaveControls } from "./WorkspaceBrowserSaveControls";
import { WORKSPACE_BROWSER_SNAPSHOT_KEY } from "./workspaceBrowserSnapshot";
import { addWorkspaceUrlTargets, writeWorkspaceUrlTargets } from "./workspaceUrlTargets";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe("UI-R04-AL manual browser snapshot UI", () => {
  it("lets a user explicitly save and delete without changing tab contents", () => {
    const targets = addWorkspaceUrlTargets(
      [], "https://youtu.be/Ab0_-123xyz",
    ).targets;
    expect(writeWorkspaceUrlTargets(sessionStorage, targets)).toBe(true);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WorkspaceBrowserSaveControls />);
    fireEvent.click(screen.getByText("작업 공간 보관"));
    expect(localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "현재 구성 보관" }));
    expect(localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY)).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("1개");
    fireEvent.click(screen.getByRole("button", { name: "보관본 삭제" }));
    expect(confirm).toHaveBeenCalled();
    expect(localStorage.getItem(WORKSPACE_BROWSER_SNAPSHOT_KEY)).toBeNull();
    expect(sessionStorage.getItem("youtopia-workspace-url-targets-v1"))
      .not.toBeNull();
  });
});
