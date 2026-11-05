import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DIAGNOSTIC_WORKSPACE_PATH, USER_WORKSPACE_PATH,
  isDiagnosticWorkspacePath, workspaceDiagnosticsEnabled,
} from "./workspaceDiagnosticsGate";

afterEach(() => vi.unstubAllEnvs());

describe("UI-R04-AC — diagnostic route is DEV-only and explicitly opted in", () => {
  it("does not register a diagnostic mode in production even if client flags are set", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_R04AC_DIAGNOSTICS", "enabled");
    expect(workspaceDiagnosticsEnabled()).toBe(false);
    expect(isDiagnosticWorkspacePath(DIAGNOSTIC_WORKSPACE_PATH)).toBe(false);
    expect(isDiagnosticWorkspacePath(USER_WORKSPACE_PATH)).toBe(false);
  });

  it("stays unavailable in ordinary development without the extra flag", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_R04AC_DIAGNOSTICS", "");
    vi.stubEnv("VITE_R04Y_SYNTHETIC_HTTP", "enabled");
    vi.stubEnv("VITE_R04AA_METADATA_STATES", "enabled");
    expect(workspaceDiagnosticsEnabled()).toBe(false);
    expect(isDiagnosticWorkspacePath(DIAGNOSTIC_WORKSPACE_PATH)).toBe(false);
  });

  it("recognizes only the exact diagnostic route with both prerequisites", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_R04AC_DIAGNOSTICS", "enabled");
    expect(workspaceDiagnosticsEnabled()).toBe(true);
    expect(isDiagnosticWorkspacePath(DIAGNOSTIC_WORKSPACE_PATH)).toBe(true);
    for (const path of [
      USER_WORKSPACE_PATH, DIAGNOSTIC_WORKSPACE_PATH + "/other",
      DIAGNOSTIC_WORKSPACE_PATH + "/", DIAGNOSTIC_WORKSPACE_PATH + "?debug=1",
    ]) expect(isDiagnosticWorkspacePath(path)).toBe(false);
  });
});
