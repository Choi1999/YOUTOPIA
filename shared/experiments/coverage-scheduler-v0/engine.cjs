
"use strict";

/**
 * YOUTOPIA YU-32 — 오프라인 합성 캐시·Job 시뮬레이터.
 *
 * 실제 YouTube/API/AI/DB/Chrome 호출 없음.
 * 기본 SAFE 모드에서는 분석 요청이 차단된다.
 * QA_SYNTHETIC 모드에서만 명시적 합성 작업을 허용한다.
 *
 * 기존 analysis-v1 및 Hover Summary wire 계약은 변경하지 않는다.
 */

const FIELDS = [
  "source", "targetType", "targetId",
  "analysisSpecVersion", "observationWindowId",
  "samplingPolicyVersion", "locale",
  "visibility", "tenantId",
];

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const SAFE_STRING = /^[A-Za-z0-9._:-]{1,80}$/;

function normalizeScope(value) {
  if (!value || typeof value !== "object" ||
      Array.isArray(value)) return null;

  if (
    Object.keys(value).length !== FIELDS.length ||
    !FIELDS.every(field =>
      Object.prototype.hasOwnProperty.call(value, field)
    )
  ) return null;

  if (
    value.source !== "YOUTUBE" ||
    value.targetType !== "VIDEO" ||
    !VIDEO_ID.test(value.targetId) ||
    !SAFE_STRING.test(value.analysisSpecVersion) ||
    !SAFE_STRING.test(value.observationWindowId) ||
    !SAFE_STRING.test(value.samplingPolicyVersion) ||
    !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value.locale)
  ) return null;

  if (value.visibility === "PUBLIC_REUSABLE") {
    if (value.tenantId !== null) return null;
  } else if (value.visibility === "TENANT_PRIVATE") {
    if (
      typeof value.tenantId !== "string" ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(value.tenantId)
    ) return null;
  } else {
    return null;
  }

  return Object.freeze(
    Object.fromEntries(FIELDS.map(key => [key, value[key]]))
  );
}

function keyOf(scope) {
  // 고정된 필드 순서로 충돌 가능성을 줄인다.
  return JSON.stringify(FIELDS.map(key => scope[key]));
}

function createSimulator({
  mode = "SAFE",
  now = () => Date.now(),
  ttlMs = 24 * 60 * 60 * 1000,
  budgetUnits = 5,
} = {}) {
  if (!["SAFE", "QA_SYNTHETIC"].includes(mode) ||
      typeof now !== "function" ||
      !Number.isSafeInteger(ttlMs) || ttlMs <= 0 ||
      !Number.isSafeInteger(budgetUnits) || budgetUnits < 0) {
    throw new TypeError("Invalid simulator configuration");
  }

  const cache = new Map();
  const jobs = new Map();
  const activeJobs = new Map();

  let nextJobId = 0;
  let usedUnits = 0;
  let hoverCount = 0;
  let lookupCount = 0;
  let freshHits = 0;
  let createdJobs = 0;
  let joinedJobs = 0;

  function access(input, viewerTenantId = null) {
    const scope = normalizeScope(input);
    if (!scope) return {kind: "INVALID_SCOPE"};

    if (
      scope.visibility === "TENANT_PRIVATE" &&
      scope.tenantId !== viewerTenantId
    ) return {kind: "ACCESS_DENIED"};

    return {
      kind: "OK",
      scope,
      key: keyOf(scope),
    };
  }

  function lookup(input, {viewerTenantId = null} = {}) {
    lookupCount += 1;

    const result = access(input, viewerTenantId);
    if (result.kind !== "OK") return {kind: result.kind};

    const entry = cache.get(result.key);
    if (!entry) return {kind: "MISS"};

    if (now() >= entry.expiresAt) {
      // STALE 결과의 감성 수치는 노출하지 않는다.
      return {
        kind: "STALE",
        snapshotId: entry.snapshotId,
        analyzedAt: entry.analyzedAt,
      };
    }

    freshHits += 1;
    return {
      kind: "FRESH",
      status: entry.status,
      snapshotId: entry.snapshotId,
      analyzedAt: entry.analyzedAt,
    };
  }

  function seedSynthetic(input, snapshot) {
    if (mode !== "QA_SYNTHETIC") {
      return {kind: "BLOCKED", reason: "DEMO_DISABLED"};
    }

    const scope = normalizeScope(input);
    if (!scope) {
      return {kind: "REJECTED", reason: "INVALID_SCOPE"};
    }
    if (
    !snapshot ||
    typeof snapshot.snapshotId !== "string" ||
    !SAFE_STRING.test(snapshot.snapshotId) ||

    // 캐시 키와 Snapshot의 대상·분석 범위 일치 검사
    snapshot.target?.source !== scope.source ||
    snapshot.target?.targetType !== scope.targetType ||
    snapshot.target?.targetId !== scope.targetId ||
    snapshot.analysisSpecVersion !== scope.analysisSpecVersion ||
    snapshot.observationWindowId !== scope.observationWindowId ||
    snapshot.samplingPolicyVersion !== scope.samplingPolicyVersion ||
    snapshot.locale !== scope.locale ||

    // 합성 출처 및 공개 범위 검사
    snapshot.sourceType !== "STATIC_FIXTURE" ||
    snapshot.isSynthetic !== true ||
    snapshot.visibility !== scope.visibility ||
    snapshot.tenantId !== scope.tenantId ||

    !["READY", "PARTIAL", "NO_DATA"].includes(snapshot.status)
    ) {
    return {
        kind: "REJECTED",
        reason: "INVALID_FIXTURE",
    };
    }

    const noData = snapshot.status === "NO_DATA";
    const analyzedAt = snapshot.analyzedAt;

    if (
      (noData && analyzedAt !== null) ||
      (!noData && (
        typeof analyzedAt !== "string" ||
        !Number.isFinite(Date.parse(analyzedAt)) ||
        Date.parse(analyzedAt) > now()
      ))
    ) {
      return {kind: "REJECTED", reason: "INVALID_TIME"};
    }

    const origin = noData ? now() : Date.parse(analyzedAt);

    cache.set(keyOf(scope), {
      snapshotId: snapshot.snapshotId,
      status: snapshot.status,
      analyzedAt,
      expiresAt: origin + ttlMs,
    });

    // 스냅샷의 수치 자체는 저장하지 않는다.
    return {kind: "SEEDED", snapshotId: snapshot.snapshotId};
  }

  function action(input, {
    viewerTenantId = null,
    requestAllowed = false,
  } = {}) {
    const checked = access(input, viewerTenantId);

    if (checked.kind !== "OK") {
      return {
        kind: "BLOCKED",
        reason: checked.kind,
        action: {type: "NONE", enabled: false},
      };
    }

    const existingJob = activeJobs.get(checked.key);

    if (existingJob) {
      return {
        kind: existingJob.state,
        jobId: existingJob.id,
        action: {
          type: "PROGRESS",
          label: "분석 진행 상태",
          enabled: false,
        },
      };
    }

    const result = lookup(input, {viewerTenantId});

    if (result.kind === "FRESH") {
      return {
        kind: result.status,
        snapshotId: result.snapshotId,
        action: result.status === "NO_DATA"
          ? {type: "NONE", enabled: false}
          : {type: "DETAIL", label: "더보기", enabled: true},
      };
    }

    const canSimulate =
      mode === "QA_SYNTHETIC" &&
      requestAllowed === true &&
      usedUnits < budgetUnits;

    const isStale = result.kind === "STALE";

    // 종료한 Job은 activeJobs에서 빠진다. 가장 최근 실패를 MISS로
    // 오인하지 않도록 종료 기록을 읽되, 최신 성공 이후의 실패만 표시한다.
    // 메모리 Job 수는 합성 예산으로 제한되며 운영 영속 큐가 아니다.
    const lastTerminal = [...jobs.values()].reverse().find(
      job => job.key === checked.key &&
        (job.state === "FAILED" || job.state === "SUCCEEDED")
    );
    const isFailed = lastTerminal?.state === "FAILED";

    return {
      kind: isFailed ? "FAILED" : result.kind,
      ...(isFailed ? {jobId: lastTerminal.id} : {}),
      analyzedAt: result.analyzedAt ?? null,
      action: canSimulate
        ? {
            type: "DEMO_REQUEST",
            label: isFailed
              ? "데모 분석 재시도 (시뮬레이션)"
              : isStale
                ? "데모 갱신 요청 (시뮬레이션)"
                : "데모 분석 요청 (시뮬레이션)",
            enabled: true,
          }
        : {
            type: "NONE",
            label: mode === "SAFE"
              ? "분석 기능 준비 중"
              : "요청 불가",
            enabled: false,
          },
    };
  }

  function hover(input, options = {}) {
    hoverCount += 1;
    // Hover는 읽기만 한다. Job 생성은 절대 하지 않는다.
    return action(input, options);
  }

  function request(input, {
    explicitClick = false,
    requestAllowed = false,
    viewerTenantId = null,
  } = {}) {
    if (explicitClick !== true) {
      return {
        kind: "REJECTED",
        reason: "EXPLICIT_CLICK_REQUIRED",
      };
    }

    if (mode !== "QA_SYNTHETIC") {
      return {kind: "BLOCKED", reason: "DEMO_DISABLED"};
    }

    const checked = access(input, viewerTenantId);

    if (checked.kind !== "OK") {
      return {kind: "BLOCKED", reason: checked.kind};
    }

    if (requestAllowed !== true) {
      return {
        kind: "BLOCKED",
        reason: "ELIGIBILITY_UNCONFIRMED",
      };
    }

    const existing = activeJobs.get(checked.key);

    if (existing) {
      joinedJobs += 1;
      return {
        kind: "JOINED",
        jobId: existing.id,
        state: existing.state,
      };
    }

    const cached = lookup(input, {viewerTenantId});

    if (cached.kind === "FRESH") {
      return {
        kind: "ALREADY_CACHED",
        snapshotId: cached.snapshotId,
      };
    }

    if (usedUnits >= budgetUnits) {
      return {kind: "QUOTA_DEFERRED"};
    }

    const job = {
      id: "qa-job-" + (++nextJobId),
      key: checked.key,
      scope: checked.scope,
      state: "QUEUED",
    };

    jobs.set(job.id, job);
    activeJobs.set(job.key, job);

    usedUnits += 1;
    createdJobs += 1;

    return {
      kind: "CREATED",
      jobId: job.id,
      state: job.state,
    };
  }

  function startNext() {
    // 현재 모델은 분석 동시 실행 1건만 시뮬레이션한다.
    if ([...jobs.values()].some(job => job.state === "RUNNING")) {
      return null;
    }

    const job = [...jobs.values()].find(
      candidate => candidate.state === "QUEUED"
    );

    if (!job) return null;

    job.state = "RUNNING";

    return {
      kind: "STARTED",
      jobId: job.id,
      state: job.state,
    };
  }

  function complete(jobId, syntheticSnapshot) {
    const job = jobs.get(jobId);

    if (!job || job.state !== "RUNNING") {
      return {kind: "REJECTED", reason: "INVALID_JOB_STATE"};
    }

    const saved = seedSynthetic(job.scope, syntheticSnapshot);

    if (saved.kind !== "SEEDED") {
      return {
        kind: "REJECTED",
        reason: "INVALID_SYNTHETIC_RESULT",
      };
    }

    job.state = "SUCCEEDED";
    activeJobs.delete(job.key);

    return {
      kind: "SUCCEEDED",
      jobId,
      snapshotId: saved.snapshotId,
    };
  }

  function fail(jobId) {
    const job = jobs.get(jobId);

    if (!job || job.state !== "RUNNING") {
      return {kind: "REJECTED", reason: "INVALID_JOB_STATE"};
    }

    job.state = "FAILED";
    activeJobs.delete(job.key);
    return {kind: "FAILED", jobId};
  }

  function getJob(jobId, {viewerTenantId = null} = {}) {
    const job = jobs.get(jobId);
    if (!job) return {kind: "NOT_FOUND"};

    if (
      access(job.scope, viewerTenantId).kind !== "OK"
    ) return {kind: "ACCESS_DENIED"};

    return {
      kind: "FOUND",
      jobId,
      state: job.state,
    };
  }

  function stats() {
    return Object.freeze({
      mode,
      hoverCount,
      lookupCount,
      freshHits,
      createdJobs,
      joinedJobs,
      activeJobs: activeJobs.size,
      usedUnits,
      budgetUnits,
    });
  }

  return Object.freeze({
    lookup,
    hover,
    action,
    request,
    seedSynthetic,
    startNext,
    complete,
    fail,
    getJob,
    stats,
  });
}

module.exports = {
  normalizeScope,
  createSimulator,
};
