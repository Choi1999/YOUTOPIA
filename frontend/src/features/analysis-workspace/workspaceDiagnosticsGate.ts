/**
 * UI-R04-AC: developer diagnostics are an opt-in Vite DEV surface, not part
 * of the consumer workspace and never registered in production route tables.
 *
 * This is presentation/routing isolation, NOT server-side authentication.
 * The Spring synthetic transport is separately guarded and loopback-only.
 */
export const USER_WORKSPACE_PATH = "/analysis/youtube/workspace";
export const DIAGNOSTIC_WORKSPACE_PATH =
  "/analysis/youtube/workspace/diagnostics";

export function workspaceDiagnosticsEnabled(): boolean {
  return import.meta.env.DEV === true &&
    import.meta.env.VITE_R04AC_DIAGNOSTICS === "enabled";
}

export function isDiagnosticWorkspacePath(pathname: string): boolean {
  return workspaceDiagnosticsEnabled() &&
    pathname === DIAGNOSTIC_WORKSPACE_PATH;
}
