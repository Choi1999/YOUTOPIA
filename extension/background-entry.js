
/**
 * YOUTOPIA 17단계 — 통합 MV3 Service Worker 진입점.
 *
 * 기존 background.js가 YU-27/YU-28을 계속 처리한다.
 * 새로운 Summary 계약은 별도의 요청 타입에서만 처리한다.
 *
 * 외부 코드나 TypeScript 파일을 가져오지 않는다.
 */

// 기존 동작을 먼저 등록한다.
importScripts("background.js");

// 신규 합성 Summary 경계를 등록한다.
importScripts(
  "hover-summary-contract.js",
  "hover-summary-transport.js",
  "demo-hover-summary-provider.js"
);

(function initializeSummaryWorker(scope) {
  "use strict";

  const contract = scope.YUTOPIA_HOVER_SUMMARY_CONTRACT;
  const transport = scope.YUTOPIA_HOVER_SUMMARY_TRANSPORT;
  const provider = scope.YOUTOPIA_DEMO_HOVER_SUMMARY_PROVIDER;

  if (
    !contract ||
    !transport?.createWorkerAdapter ||
    !provider?.getSummary ||
    !scope.chrome?.runtime?.id
  ) {
    throw new Error("HOVER_SUMMARY_WORKER_INIT_FAILED");
  }

  const adapter = transport.createWorkerAdapter({
    extensionId: scope.chrome.runtime.id,
    provider,
  });

  if (!adapter) {
    throw new Error("HOVER_SUMMARY_ADAPTER_INIT_FAILED");
  }

  /*
   * 반드시 일반 함수 리스너를 사용한다.
   * 지원하지 않는 메시지에는 응답하지 않는다.
   *
   * 비동기 sendResponse의 true 반환은
   * createWorkerAdapter가 담당한다.
   */
  scope.chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (message?.type !== contract.REQUEST_TYPE) {
        return false;
      }

      return adapter.handleMessage(
        message,
        sender,
        sendResponse
      );
    }
  );
})(globalThis);
