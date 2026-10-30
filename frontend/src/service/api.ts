export type Identity = {
  kind: "USER" | "ADMIN";
  id: string;
  emailVerified: boolean;
};
export type Theme = "system" | "dark" | "light";
export type Settings = { version: number; values: { theme: Theme } };
export type Metric = {
  availability: string;
  value: number | null;
  observedAt: string | null;
};
export type Game = {
  gameId: string;
  steamAppId: number;
  name: string;
  developers: { availability: string; value: string[] | null };
  releaseAt: { availability: string; value: string | null };
  steamConnection: string;
  youtubeConnection: string;
  currentCcu: Metric;
  peak24h: Metric;
  newYoutubeVideos: Metric;
  freshness: string;
};
export type Listing = {
  content: Game[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
  asOf: string;
  dataStatus: string;
  freshness: string;
  searchTracking?: {
    availability: string;
    clientEventId: string;
    searchContextId: string | null;
    properties: Record<string, unknown> | null;
    receipt: string | null;
  };
};
export type Point = {
  scheduledAt: string;
  observedAt: string;
  playerCount: number;
};
export type Ccu = {
  appId: number;
  days: number;
  dataStatus: string;
  freshnessStatus: string;
  lastObservedAt: string | null;
  points: Point[];
};
export type Detail = {
  game: Game;
  asOf: string;
  steamPreview: Ccu;
  youtubePreviewAvailability: string;
};
export type Period = {
  source: string;
  category: string | null;
  start: string;
  end: string;
};
export type Move = {
  appId: number;
  name: string | null;
  previous: number;
  current: number;
  positionChange: number;
};
export type RankRegion = {
  country: string;
  availability: string;
  comparable: number;
  uncomparable: number;
  up: number;
  down: number;
  same: number;
  upRatio: number | null;
  downRatio: number | null;
  sameRatio: number | null;
  deltaHistogram: Record<string, number>;
  topRisers: Move[];
  topFallers: Move[];
};
export type RankPair = {
  appId: number;
  name: string | null;
  krPosition: number;
  unspecifiedPosition: number;
  absoluteGap: number;
};
export type RankReport = {
  source: string;
  category: string | null;
  asOf: string;
  calculationVersion: string;
  charts: {
    rankOneAtTop: boolean;
    weeks: {
      periodStart: string;
      kr: RankRegion;
      unspecified: RankRegion;
      pairAvailability: string;
      pairs: RankPair[];
      largestGaps: RankPair[];
    }[];
    lastThreeWeekTrends: {
      appId: number;
      name: string | null;
      country: string;
      points: { periodStart: string; position: number }[];
    }[];
    top20Continuity: {
      country: string;
      expectedWeeks: number;
      observedWeeks: number;
      availability: string;
      enteredTop20: number;
      everyWeekTop20: number | null;
    }[];
  };
};
export type Change = {
  appId: number;
  availability: string;
  reason: string | null;
  previousSlot: string | null;
  currentSlot: string | null;
  previous: number | null;
  current: number | null;
  difference: number | null;
  percent: number | null;
  elapsedSeconds: number | null;
};
export type CcuCharts = {
  asOf: string;
  recent: Change[];
  exact24Hours: {
    requested: number;
    comparable: number;
    excluded: number;
    up: number;
    down: number;
    same: number;
    comparisons: Change[];
  };
};
export type Composition = {
  asOf: string;
  dataStatus: string;
  composition: {
    total: number;
    games: number;
    nonGames: number;
    unknown: number;
    gameRatio: number | null;
    nonGameRatio: number | null;
    unknownRatio: number | null;
  };
};
export type VideoReport = {
  from: string;
  to: string;
  mappingBasis: string;
  comparison: {
    availability: string;
    reason: string | null;
    elapsedSeconds: number | null;
    cumulativeDifference: number | null;
    first: { views: number; slot: string } | null;
    last: { views: number; slot: string } | null;
  };
  observations: {
    id: number;
    slot: string;
    receivedAt: string;
    views: number;
  }[];
};
export type Associations = {
  relevanceVerification: string;
  accelerationAvailability: string;
  accelerationReason: string;
  content: {
    appId: number;
    queryAssociatedVideos: number;
    comparableVideos: number;
    comparableRatio: number | null;
  }[];
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public traceId?: string,
    public retryAfter?: string,
  ) {
    super(code);
  }
}
export function errorText(error: unknown): string {
  if (!(error instanceof ApiError))
    return "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
  const codes: Record<string, string> = {
    CSRF_INVALID: "요청 확인 정보가 만료되었습니다. 다시 시도해 주세요.",
    ACCOUNT_CONTEXT_CHANGED:
      "접속 계정이 변경되었습니다. 새로 확인한 뒤 다시 시도해 주세요.",
    USER_ALREADY_EXISTS:
      "이미 등록된 이메일입니다. 로그인 또는 계정 복구를 이용해 주세요.",
    REQUEST_TIMEOUT: "응답 시간이 초과되었습니다.",
    NETWORK_UNAVAILABLE: "서버에 연결하지 못했습니다.",
    INVALID_RESPONSE: "서버 응답을 확인할 수 없습니다.",
  };
  return (
    codes[error.code] ??
    (error.status === 401
      ? "로그인 정보 또는 세션을 확인해 주세요."
      : error.status === 403
        ? "이 작업에 대한 권한이 없습니다."
        : error.status === 404
          ? "요청한 데이터가 없거나 아직 제공되지 않습니다."
          : error.status === 409
            ? "다른 변경과 충돌했습니다. 최신 상태를 확인해 주세요."
            : error.status === 429
              ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
              : error.status >= 500
                ? "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
                : "입력값을 확인해 주세요.")
  );
}
export class ServiceApi {
  constructor(
    private fetcher: typeof fetch = (...args) => fetch(...args),
    private timeoutMs = 10000,
  ) {}
  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      signal?: AbortSignal;
      account?: string;
    } = {},
  ): Promise<T> {
    if (!path.startsWith("/api/v1/") || path.includes("://"))
      throw new Error("Same-origin API path required");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      const method = options.method ?? "GET",
        headers: Record<string, string> = { Accept: "application/json" };
      if (options.account) headers["X-Youtopia-Account"] = options.account;
      if (method !== "GET") {
        const csrf = await this.request<{ token: string; headerName: string }>(
          "/api/v1/auth/csrf",
          { signal: controller.signal },
        );
        if (
          csrf.headerName !== "X-CSRF-TOKEN" ||
          typeof csrf.token !== "string" ||
          !csrf.token
        )
          throw new ApiError(0, "INVALID_RESPONSE");
        headers["X-CSRF-TOKEN"] = csrf.token;
        headers["Content-Type"] = "application/json";
      }
      const response = await this.fetcher(path, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (!response.ok) {
        let code = "REQUEST_FAILED",
          traceId: string | undefined;
        try {
          const problem = await response.json();
          if (
            typeof problem.code === "string" &&
            /^[A-Z0-9_]{1,80}$/.test(problem.code)
          )
            code = problem.code;
          if (typeof problem.traceId === "string")
            traceId = problem.traceId.slice(0, 80);
        } catch {
          /* Never render arbitrary proxy/server text. */
        }
        if (
          (response.status === 401 &&
            !new Set([
              "/api/v1/auth/me",
              "/api/v1/admin/auth/me",
              "/api/v1/auth/login",
              "/api/v1/admin/auth/login",
              "/api/v1/auth/signup",
              "/api/v1/auth/csrf",
              "/api/v1/auth/password-reset",
              "/api/v1/auth/account-recovery",
            ]).has(path)) ||
          code === "ACCOUNT_CONTEXT_CHANGED"
        )
          window.dispatchEvent(new Event("youtopia-session-changed"));
        throw new ApiError(
          response.status,
          code,
          traceId,
          response.headers.get("Retry-After") ?? undefined,
        );
      }
      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch {
        throw new ApiError(0, "INVALID_RESPONSE");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted)
        throw new DOMException("Request cancelled", "AbortError");
      throw new ApiError(
        0,
        timedOut ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE",
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
  async me(signal?: AbortSignal) {
    try {
      return await this.request<Identity>("/api/v1/auth/me", { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403)
        return this.request<Identity>("/api/v1/admin/auth/me", { signal });
      throw error;
    }
  }
  login(login: string, password: string, admin = false) {
    return this.request<Identity>(
      admin ? "/api/v1/admin/auth/login" : "/api/v1/auth/login",
      { method: "POST", body: { login, password } },
    );
  }
  logout() {
    return this.request<void>("/api/v1/auth/logout", {
      method: "POST",
      body: {},
    });
  }
  settings(account: string, signal?: AbortSignal) {
    return this.request<Settings>("/api/v1/me/settings", { account, signal });
  }
  saveTheme(account: string, version: number, theme: Theme) {
    return this.request<Settings>("/api/v1/me/settings", {
      method: "PATCH",
      account,
      body: { expectedVersion: version, changes: { theme } },
    });
  }
  async games(params: URLSearchParams, signal?: AbortSignal) {
    const value = await this.request<Listing>("/api/v1/games?" + params, {
      signal,
    });
    if (!Array.isArray(value.content) || !value.page)
      throw new ApiError(0, "INVALID_RESPONSE");
    return value;
  }
  search(params: Record<string, unknown>, signal?: AbortSignal) {
    return this.request<Listing>("/api/v1/games/search", {
      method: "POST",
      body: { ...params, clientEventId: crypto.randomUUID() },
      signal,
    });
  }
  detail(id: string, signal?: AbortSignal) {
    return this.request<Detail>("/api/v1/games/" + encodeURIComponent(id), {
      signal,
    });
  }
  ccu(id: number, days: number, signal?: AbortSignal) {
    return this.request<Ccu>(`/api/v1/steam/apps/${id}/ccu?days=${days}`, {
      signal,
    });
  }
  periods(signal?: AbortSignal) {
    return this.request<{ content: Period[]; dataStatus: string }>(
      "/api/v1/charts/steam/ranking-periods",
      { signal },
    );
  }
  rankings(params: URLSearchParams, signal?: AbortSignal) {
    return this.request<RankReport>("/api/v1/charts/steam/rankings?" + params, {
      signal,
    });
  }
  ccuCharts(ids: number[], days: number, signal?: AbortSignal) {
    return this.request<CcuCharts>(
      `/api/v1/charts/steam/ccu?appIds=${ids.join(",")}&days=${days}`,
      { signal },
    );
  }
  composition(signal?: AbortSignal) {
    return this.request<Composition>("/api/v1/charts/steam/app-types", {
      signal,
    });
  }
  video(id: string, days: number, signal?: AbortSignal) {
    return this.request<VideoReport>(
      `/api/v1/youtube/videos/${encodeURIComponent(id)}/observations?days=${days}`,
      { signal },
    );
  }
  associations(ids: number[], days: number, signal?: AbortSignal) {
    return this.request<Associations>(
      `/api/v1/charts/youtube/query-associations?appIds=${ids.join(",")}&days=${days}`,
      { signal },
    );
  }
}
export const serviceApi = new ServiceApi();
