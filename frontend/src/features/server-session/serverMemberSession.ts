/**
 * UI-R04-AO — optional real Spring USER session client, not the demo login.
 *
 * Only four fixed, same-origin /api/v1/auth endpoints are used. Browser-managed
 * HttpOnly session cookies are never inspected or serialized. Credentials,
 * CSRF tokens and server errors are never put in browser storage or logs.
 *
 * This does not make YouTube calls, load provider metadata or grant roles.
 */
export type ServerMemberIdentity = Readonly<{
  kind: "USER";
  id: string;
  emailVerified: boolean;
}>;

export type ServerMemberState =
  | Readonly<{ status: "guest" }>
  | Readonly<{ status: "authenticated"; identity: ServerMemberIdentity }>;

export type ServerSessionFailure =
  | "NETWORK_UNAVAILABLE"
  | "SERVER_RESPONSE_INVALID"
  | "SERVER_SESSION_UNAVAILABLE"
  | "CSRF_UNAVAILABLE"
  | "LOGIN_REJECTED"
  | "LOGOUT_REJECTED"
  | "SESSION_NOT_CONFIRMED";

export class ServerSessionError extends Error {
  constructor(public readonly code: ServerSessionFailure) {
    super(code);
    this.name = "ServerSessionError";
  }
}

const URLS = {
  csrf: "/api/v1/auth/csrf",
  login: "/api/v1/auth/login",
  me: "/api/v1/auth/me",
  logout: "/api/v1/auth/logout",
} as const;

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MAX_JSON_LENGTH = 4096;
const MAX_CSRF_LENGTH = 2048;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validMemberIdentity(value: unknown): value is ServerMemberIdentity {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.every(key => [
    "kind", "id", "emailVerified", "authVersion", "adminGeneration",
  ].includes(key)) &&
    value.kind === "USER" &&
    typeof value.id === "string" && UUID.test(value.id) &&
    typeof value.emailVerified === "boolean" &&
    (value.authVersion === undefined ||
      (typeof value.authVersion === "string" &&
        /^[0-9]{1,30}$/.test(value.authVersion))) &&
    (value.adminGeneration === undefined || value.adminGeneration === null);
}

async function jsonResponse(response: Response): Promise<unknown> {
  if (!response.headers.get("Content-Type")?.toLowerCase()
    .startsWith("application/json")) {
    throw new ServerSessionError("SERVER_RESPONSE_INVALID");
  }
  try {
    const text = await response.text();
    if (text.length < 2 || text.length > MAX_JSON_LENGTH)
      throw new ServerSessionError("SERVER_RESPONSE_INVALID");
    return JSON.parse(text) as unknown;
  } catch {
    throw new ServerSessionError("SERVER_RESPONSE_INVALID");
  }
}

/**
 * A fetch implementation may be injected only for isolated tests.
 * A 200 login response alone is never a trusted session: /me must confirm it.
 */
export class ServerMemberClient {
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args)) {}

  private async request(
    path: (typeof URLS)[keyof typeof URLS],
    init: { method?: "GET" | "POST"; csrf?: string; body?: string } = {},
  ): Promise<Response> {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (init.csrf) headers["X-CSRF-TOKEN"] = init.csrf;
      if (init.body !== undefined) headers["Content-Type"] = "application/json";
      return await this.transport(path, {
        method: init.method ?? "GET",
        headers,
        body: init.body,
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      });
    } catch {
      throw new ServerSessionError("NETWORK_UNAVAILABLE");
    }
  }

  private async csrf(): Promise<string> {
    const response = await this.request(URLS.csrf);
    if (!response.ok) throw new ServerSessionError("CSRF_UNAVAILABLE");
    const data = await jsonResponse(response);
    if (!isRecord(data) || data.headerName !== "X-CSRF-TOKEN" ||
        typeof data.token !== "string" || data.token.length < 1 ||
        data.token.length > MAX_CSRF_LENGTH ||
        /[\u0000-\u001f\u007f]/.test(data.token)) {
      throw new ServerSessionError("CSRF_UNAVAILABLE");
    }
    return data.token;
  }

  async check(): Promise<ServerMemberState> {
    const response = await this.request(URLS.me);
    if (response.status === 401) return { status: "guest" };
    if (!response.ok) throw new ServerSessionError("SERVER_SESSION_UNAVAILABLE");
    const value = await jsonResponse(response);
    if (!validMemberIdentity(value))
      throw new ServerSessionError("SERVER_RESPONSE_INVALID");
    return {
      status: "authenticated",
      identity: {
        kind: "USER",
        id: value.id,
        emailVerified: value.emailVerified,
      },
    };
  }

  async login(login: string, password: string): Promise<ServerMemberIdentity> {
    const account = login.trim();
    if (!account || account.length > 254 || !password ||
        password.length > 512) {
      throw new ServerSessionError("LOGIN_REJECTED");
    }
    const token = await this.csrf();
    const response = await this.request(URLS.login, {
      method: "POST",
      csrf: token,
      body: JSON.stringify({ login: account, password }),
    });
    if (!response.ok) throw new ServerSessionError("LOGIN_REJECTED");
    const submitted = await jsonResponse(response);
    if (!validMemberIdentity(submitted))
      throw new ServerSessionError("SERVER_RESPONSE_INVALID");
    // Session cookie and role are server-owned. Confirm the cookie was sent
    // back and that the server still considers this the same USER identity.
    const confirmed = await this.check();
    if (confirmed.status !== "authenticated" ||
        confirmed.identity.id !== submitted.id) {
      throw new ServerSessionError("SESSION_NOT_CONFIRMED");
    }
    return confirmed.identity;
  }

  async logout(): Promise<void> {
    const token = await this.csrf();
    const response = await this.request(URLS.logout, {
      method: "POST",
      csrf: token,
      body: "{}",
    });
    if (response.status !== 204)
      throw new ServerSessionError("LOGOUT_REJECTED");
    const state = await this.check();
    if (state.status !== "guest")
      throw new ServerSessionError("SESSION_NOT_CONFIRMED");
  }
}

export const serverMemberClient = new ServerMemberClient();

export function serverSessionErrorMessage(error: unknown): string {
  if (!(error instanceof ServerSessionError))
    return "서버 상태를 확인하지 못했습니다. 다시 확인해 주세요.";
  switch (error.code) {
    case "LOGIN_REJECTED": return "서버가 로그인을 승인하지 않았습니다. 계정 정보를 확인하세요.";
    case "CSRF_UNAVAILABLE": return "서버의 요청 보호 토큰을 받지 못했습니다.";
    case "SESSION_NOT_CONFIRMED": return "서버의 세션 확인에 실패했습니다. 로그인으로 처리하지 않습니다.";
    case "LOGOUT_REJECTED": return "서버 로그아웃이 확인되지 않았습니다.";
    case "SERVER_RESPONSE_INVALID": return "서버 응답 형식을 신뢰할 수 없어 로그인을 처리하지 않았습니다.";
    case "SERVER_SESSION_UNAVAILABLE":
    case "NETWORK_UNAVAILABLE":
    default: return "Spring 회원 서버에 연결할 수 없거나 세션을 확인할 수 없습니다.";
  }
}
