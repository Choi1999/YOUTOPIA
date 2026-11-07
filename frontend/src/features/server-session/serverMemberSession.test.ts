import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ServerMemberClient, ServerSessionError, serverSessionErrorMessage,
} from "./serverMemberSession";

const USER = {
  kind: "USER",
  id: "12345678-1234-1234-1234-123456789abc",
  emailVerified: false,
  authVersion: "2",
  adminGeneration: null,
};
const CSRF = {
  headerName: "X-CSRF-TOKEN",
  parameterName: "_csrf",
  token: "synthetic-csrf-123",
};

function response(status: number, body?: unknown, contentType = "application/json"): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => name.toLowerCase() === "content-type"
      ? contentType : null },
    text: async () => body === undefined ? "" : JSON.stringify(body),
  } as unknown as Response;
}

function client(...responses: Response[]) {
  const spy = vi.fn<typeof fetch>()
    .mockImplementation(async () => {
      const next = responses.shift();
      if (!next) throw new Error("No more synthetic responses");
      return next;
    });
  return { api: new ServerMemberClient(spy), spy };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("UI-R04-AO — same-origin server-owned USER sessions", () => {
  it("treats anonymous 401 as guest, never as demo authenticated", async () => {
    const { api, spy } = client(response(401));
    expect(await api.check()).toEqual({ status: "guest" });
    expect(spy).toHaveBeenCalledTimes(1);
    const [path, options] = spy.mock.calls[0];
    expect(path).toBe("/api/v1/auth/me");
    expect(options).toMatchObject({
      method: "GET", credentials: "same-origin", mode: "same-origin",
      cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
    });
  });

  it("only recognizes a valid server USER identity, not ADMIN or forged data", async () => {
    const yes = client(response(200, USER));
    expect(await yes.api.check()).toEqual({
      status: "authenticated",
      identity: {kind:"USER",id:USER.id,emailVerified:false},
    });
    const admin = client(response(200, {...USER,kind:"ADMIN"}));
    await expect(admin.api.check()).rejects.toMatchObject({
      code: "SERVER_RESPONSE_INVALID",
    });
    const foreign = client(response(200, {...USER,id:"demo"}));
    await expect(foreign.api.check()).rejects.toMatchObject({
      code: "SERVER_RESPONSE_INVALID",
    });
    const forbidden = client(response(403));
    await expect(forbidden.api.check()).rejects.toMatchObject({
      code: "SERVER_SESSION_UNAVAILABLE",
    });
  });

  it("uses Spring CSRF, then POST login, then GET me before displaying authentication", async () => {
    const { api, spy } = client(
      response(200, CSRF), response(200, USER), response(200, USER),
    );
    const member = await api.login(" member@example.invalid ", "synthetic-password");
    expect(member.id).toBe(USER.id);
    expect(spy.mock.calls.map(call => call[0])).toEqual([
      "/api/v1/auth/csrf", "/api/v1/auth/login", "/api/v1/auth/me",
    ]);
    const post = spy.mock.calls[1][1]!;
    expect(post).toMatchObject({
      method: "POST", credentials: "same-origin", mode: "same-origin",
      cache: "no-store", redirect: "error",
    });
    expect((post.headers as Record<string,string>)["X-CSRF-TOKEN"])
      .toBe("synthetic-csrf-123");
    expect(JSON.parse(String(post.body))).toEqual({
      login:"member@example.invalid",password:"synthetic-password",
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(spy.mock.calls[0][1]?.body).toBeUndefined();
    expect(spy.mock.calls[2][1]?.body).toBeUndefined();
  });

  it("cannot POST credentials without a valid server CSRF token", async () => {
    const { api, spy } = client(response(200, {...CSRF,headerName:"X-Role"}));
    await expect(api.login("member@example.invalid","synthetic"))
      .rejects.toMatchObject({code:"CSRF_UNAVAILABLE"});
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects 200 login if me is 401 or belongs to a different identity", async () => {
    const lost = client(response(200,CSRF),response(200,USER),response(401));
    await expect(lost.api.login("member@example.invalid","synthetic"))
      .rejects.toMatchObject({code:"SESSION_NOT_CONFIRMED"});
    const switched = client(response(200,CSRF),response(200,USER),
      response(200,{...USER,id:"00000000-0000-0000-0000-000000000001"}));
    await expect(switched.api.login("member@example.invalid","synthetic"))
      .rejects.toMatchObject({code:"SESSION_NOT_CONFIRMED"});
  });

  it("verifies server logout by checking that /me becomes 401", async () => {
    const {api,spy} = client(response(200,CSRF),response(204),response(401));
    await expect(api.logout()).resolves.toBeUndefined();
    expect(spy.mock.calls.map(call=>call[0])).toEqual([
      "/api/v1/auth/csrf","/api/v1/auth/logout","/api/v1/auth/me",
    ]);
    expect(spy.mock.calls[1][1]?.method).toBe("POST");
    expect((spy.mock.calls[1][1]?.headers as Record<string,string>)["X-CSRF-TOKEN"])
      .toBe(CSRF.token);
    const stillSigned = client(response(200,CSRF),response(204),response(200,USER));
    await expect(stillSigned.api.logout()).rejects.toMatchObject({
      code:"SESSION_NOT_CONFIRMED",
    });
  });

  it("fails closed when transport or JSON response is unavailable", async () => {
    const noNetwork = new ServerMemberClient(vi.fn<typeof fetch>()
      .mockRejectedValue(new Error("sensitive provider failure")));
    await expect(noNetwork.check()).rejects.toMatchObject({
      code:"NETWORK_UNAVAILABLE",
    });
    const badJson = client(response(200,USER,"text/html"));
    await expect(badJson.api.check()).rejects.toMatchObject({
      code:"SERVER_RESPONSE_INVALID",
    });
    const text = serverSessionErrorMessage(
      new ServerSessionError("NETWORK_UNAVAILABLE"));
    expect(text).not.toContain("sensitive provider failure");
    expect(text).toContain("Spring 회원 서버");
  });
});
