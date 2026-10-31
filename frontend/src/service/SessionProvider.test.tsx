import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./SessionProvider";
import { ApiError, serviceApi, type Identity } from "./api";
let session: ReturnType<typeof useSession>;
const identity: Identity = { id: "synthetic", kind: "USER", emailVerified: false };
function Probe() { session = useSession(); return <output>{session.status}</output>; }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
async function mount() {
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.spyOn(serviceApi, "me").mockRejectedValue(new ApiError(401, "UNAUTHENTICATED"));
  const view = render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument()); return view;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("orders login then logout cookies and ignores login after logout intent", async () => {
  await mount(); const login = deferred<Identity>();
  vi.spyOn(serviceApi,"login").mockReturnValue(login.promise);
  const logout = vi.spyOn(serviceApi,"logout").mockResolvedValue(undefined);
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first=session.login("synthetic", "synthetic"); second=session.logout(); });
  await act(async () => { await Promise.resolve(); }); expect(logout).not.toHaveBeenCalled();
  expect(screen.getByText("checking")).toBeInTheDocument();
  await act(async () => { login.resolve(identity); await first; await second; });
  expect(screen.getByText("guest")).toBeInTheDocument(); expect(logout).toHaveBeenCalledOnce();
});
it("does not let refresh or focus replace an in-flight login", async () => {
  await mount(); const login=deferred<Identity>();
  vi.spyOn(serviceApi,"login").mockReturnValue(login.promise);
  let pending!: Promise<void>; act(() => { pending=session.login("synthetic","synthetic"); });
  await act(async () => { window.dispatchEvent(new Event("focus")); await session.refresh(); });
  expect(serviceApi.me).toHaveBeenCalledTimes(1);
  await act(async () => { login.resolve(identity); await pending; });
  expect(screen.getByText("authenticated")).toBeInTheDocument();
});
it("rejects stale refresh after logout and continues queue after failure", async () => {
  await mount(); const refresh=deferred<Identity>(); vi.mocked(serviceApi.me).mockReturnValue(refresh.promise);
  vi.spyOn(serviceApi,"login").mockRejectedValue(new Error("synthetic failure"));
  vi.spyOn(serviceApi,"logout").mockResolvedValue(undefined);
  let old!: Promise<void>, failed!: Promise<void>, last!: Promise<void>;
  act(() => { old=session.refresh(); failed=session.login("synthetic","synthetic").catch(() => {}); last=session.logout(); });
  await act(async () => { await failed; await last; refresh.resolve(identity); await old; });
  expect(screen.getByText("guest")).toBeInTheDocument();
});
it("ignores completion after unmount", async () => {
  const view=await mount(); const login=deferred<Identity>(); vi.spyOn(serviceApi,"login").mockReturnValue(login.promise);
  let pending!: Promise<void>; act(() => { pending=session.login("synthetic","synthetic"); }); view.unmount();
  await act(async () => { login.resolve(identity); await pending; });
});
