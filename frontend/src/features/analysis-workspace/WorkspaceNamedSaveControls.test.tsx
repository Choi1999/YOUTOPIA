import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceBrowserSaveControls } from "./WorkspaceBrowserSaveControls";
import { WORKSPACE_NAMED_SNAPSHOTS_KEY } from "./workspaceNamedSnapshots";
import { addWorkspaceUrlTargets, writeWorkspaceUrlTargets } from "./workspaceUrlTargets";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {vi.restoreAllMocks();});

describe("UI-R04-AM named workspace controls", () => {
  it("creates, renames and deletes a named snapshot while leaving the tab intact", () => {
    const targets=addWorkspaceUrlTargets(
      [],"https://youtu.be/Ab0_-123xyz",
    ).targets;
    expect(writeWorkspaceUrlTargets(sessionStorage,targets)).toBe(true);
    const confirm=vi.spyOn(window,"confirm").mockReturnValue(true);
    render(<WorkspaceBrowserSaveControls />);
    fireEvent.click(screen.getByText("작업 공간 보관"));
    fireEvent.click(screen.getByText("이름별 작업 공간 관리"));
    expect(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY)).toBeNull();

    const field=screen.getByRole("textbox",{name:"작업 공간 보관 이름"});
    fireEvent.change(field,{target:{value:"분석 프로젝트 A"}});
    fireEvent.click(screen.getByRole("button",{name:"현재 구성 이름으로 보관"}));
    expect(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY))
      .toContain("분석 프로젝트 A");
    expect(screen.getByRole("status")).toHaveTextContent("분석 프로젝트 A");

    fireEvent.change(field,{target:{value:"분석 프로젝트 B"}});
    fireEvent.click(screen.getByRole("button",{name:"이름 변경"}));
    expect(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY))
      .toContain("분석 프로젝트 B");
    expect(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY))
      .not.toContain("분석 프로젝트 A");

    fireEvent.click(screen.getByRole("button",{name:"선택 구성 삭제"}));
    expect(confirm).toHaveBeenCalled();
    expect(localStorage.getItem(WORKSPACE_NAMED_SNAPSHOTS_KEY)).toBeNull();
    expect(sessionStorage.getItem("youtopia-workspace-url-targets-v1"))
      .not.toBeNull();
  });
});
