
/**
 * YOUTOPIA Hover Summary Transport — 16단계.
 *
 * Worker: 발신자 검증, 요청 순서 검사, 공급자 응답 검증.
 * Content: 요청 송신, 응답 검증, 오래된 Hover 응답 폐기.
 *
 * 기존 YU-27/YU-28과 독립적으로 테스트한다.
 * 실제 Chrome 런타임 등록, API, 저장소 접근은 하지 않는다.
 */
(function registerHoverSummaryTransport(scope) {
  "use strict";

  if (scope.YUTOPIA_HOVER_SUMMARY_TRANSPORT) return;

  const contract = scope.YUTOPIA_HOVER_SUMMARY_CONTRACT;
  if (!contract) return;

  const MAX_SCOPES = 64;

  /*
   * 기존 YU-27과 동일한 최상위 YouTube Content Script
   * 발신자 조건을 요구한다.
   *
   * sender는 실제 Chrome 런타임에서 전달된 값이어야 한다.
   * 페이지 JS나 요청 payload의 발신자 주장은 신뢰하지 않는다.
   */
  function senderScope(sender, extensionId) {
    if (
      sender?.id !== extensionId ||
      !Number.isSafeInteger(sender?.tab?.id) ||
      sender.tab.id < 0 ||
      sender.frameId !== 0 ||
      typeof sender.documentId !== "string" ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(sender.documentId) ||
      typeof sender.url !== "string"
    ) {
      return null;
    }

    try {
      if (
        new URL(sender.url).origin !==
        "https://www.youtube.com"
      ) {
        return null;
      }
    } catch {
      return null;
    }

    return sender.tab.id + ":" + sender.documentId;
  }

  /*
   * Chrome Service Worker에서 사용할 독립 수신 어댑터.
   *
   * provider.getSummary는 향후 신뢰된 Worker 코드가
   * 명시적으로 주입해야 한다.
   *
   * 이번 단계에서는 테스트용 공급자만 사용한다.
   */
  function createWorkerAdapter(options = {}) {
    const { extensionId, provider } = options;

    if (
      typeof extensionId !== "string" ||
      extensionId.length === 0 ||
      typeof provider?.getSummary !== "function"
    ) {
      return null;
    }

    const latestByScope = new Map();
    let disposed = false;

    function handleMessage(message, sender, sendResponse) {
      // 기존 메시지는 이 어댑터가 처리하지 않는다.
      if (message?.type !== contract.REQUEST_TYPE) {
        return false;
      }

      if (typeof sendResponse !== "function") {
        return false;
      }

      function reply(value) {
        try {
          sendResponse(value);
        } catch {
          // 응답 채널이 이미 닫힌 경우 재전송하지 않는다.
        }
      }

      const request = contract.parseRequest(message);
      const scopeKey = senderScope(sender, extensionId);

      if (disposed || !request || scopeKey === null) {
        reply(null);
        return false;
      }

      const targetKey =
        request.targetType + ":" + request.targetId;

      const previous = latestByScope.get(scopeKey);

      if (
        previous &&
        (
          request.requestId < previous.requestId ||
          (
            request.requestId === previous.requestId &&
            targetKey !== previous.targetKey
          )
        )
      ) {
        // 오래된 요청과 동일 requestId의 다른 대상은 무시.
        reply(null);
        return false;
      }

      const revision = Object.freeze({
        requestId: request.requestId,
        targetKey,
      });

      latestByScope.delete(scopeKey);
      latestByScope.set(scopeKey, revision);

      // 테스트용 Worker의 추적 상태를 제한한다.
      if (latestByScope.size > MAX_SCOPES) {
        const oldest = latestByScope.keys().next().value;
        latestByScope.delete(oldest);
      }

      const isCurrent = () =>
        !disposed && latestByScope.get(scopeKey) === revision;

      let work;

      try {
        work = Promise.resolve(
          provider.getSummary({
            source: "YOUTUBE",
            targetType: request.targetType,
            targetId: request.targetId,
          })
        );
      } catch {
        work = Promise.reject();
      }

      work.then(
        (result) => {
          if (!isCurrent()) {
            reply(null);
            return;
          }

          let response = null;

          try {
            response = contract.makeResponse(
              request,
              result
            );
          } catch {
            response = null;
          }

          if (!response) {
            response = contract.makeResponse(request, {
              kind: "REJECTED",
              reason: "INVALID_RESPONSE",
            });
          }

          reply(response);
        },
        () => {
          if (!isCurrent()) {
            reply(null);
            return;
          }

          reply(contract.makeResponse(request, {
            kind: "REJECTED",
            reason: "SOURCE_ERROR",
          }));
        }
      );

      // Chrome MV3 비동기 sendResponse 계약.
      return true;
    }

    function dispose() {
      disposed = true;
      latestByScope.clear();
    }

    return Object.freeze({
      handleMessage,
      dispose,
      getRuntimeStatus: () => Object.freeze({
        disposed,
        trackedScopes: latestByScope.size,
      }),
    });
  }

  /*
   * Content Script용 독립 송신 어댑터.
   *
   * sendMessage:
   *   향후 chrome.runtime.sendMessage를 주입한다.
   *
   * isCurrentRequest:
   *   기존 Hover Controller의 isCurrentRequest를 사용한다.
   *
   * IGNORED는 로컬 응답 폐기 상태이며
   * 15단계 메시지 프로토콜에 전송되지 않는다.
   */
  function createContentAdapter(options = {}) {
    const { sendMessage, isCurrentRequest } = options;

    if (
      typeof sendMessage !== "function" ||
      typeof isCurrentRequest !== "function"
    ) {
      return null;
    }

    let disposed = false;
    let activeToken = null;

    function getSummary(targetType, targetId, requestId) {
      if (disposed) {
        return Promise.resolve({ kind: "IGNORED" });
      }

      const request = contract.makeRequest(
        targetType,
        targetId,
        requestId
      );

      if (!request) {
        return Promise.resolve({
          kind: "TRANSPORT_ERROR",
          reason: "INVALID_REQUEST",
        });
      }

      const token = {};
      activeToken = token;

      function stillCurrent() {
        if (disposed || activeToken !== token) {
          return false;
        }

        try {
          return isCurrentRequest(request) === true;
        } catch {
          return false;
        }
      }

      if (!stillCurrent()) {
        return Promise.resolve({ kind: "IGNORED" });
      }

      let pending;

      try {
        pending = sendMessage(request);
      } catch {
        return Promise.resolve(
          stillCurrent()
            ? {
                kind: "TRANSPORT_ERROR",
                reason: "SEND_FAILED",
              }
            : { kind: "IGNORED" }
        );
      }

      return Promise.resolve(pending).then(
        (response) => {
          if (!stillCurrent()) {
            return { kind: "IGNORED" };
          }

          let accepted = null;

          try {
            accepted = contract.parseResponse(
              response,
              request
            );
          } catch {
            accepted = null;
          }

          if (!accepted) {
            return {
              kind: "TRANSPORT_ERROR",
              reason: "INVALID_RESPONSE",
            };
          }

          return {
            kind: "ACCEPTED",
            response: accepted,
          };
        },
        () =>
          stillCurrent()
            ? {
                kind: "TRANSPORT_ERROR",
                reason: "SEND_FAILED",
              }
            : { kind: "IGNORED" }
      );
    }

    function invalidate() {
      activeToken = null;
    }

    function dispose() {
      disposed = true;
      activeToken = null;
    }

    return Object.freeze({
      getSummary,
      invalidate,
      dispose,
      getRuntimeStatus: () => Object.freeze({
        disposed,
        hasActiveRequest: activeToken !== null,
      }),
    });
  }

  scope.YUTOPIA_HOVER_SUMMARY_TRANSPORT =
    Object.freeze({
      createWorkerAdapter,
      createContentAdapter,
    });
})(globalThis);
