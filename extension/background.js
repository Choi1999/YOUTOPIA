/*
 * YUTOPIA Chrome MV3 Service Worker — 20번 스켈레톤
 *
 * 목적: Chrome Side Panel이 열릴 수 있도록 기본 설정.
 * 아직 영상/채널 대상 메시지와 데이터 캐시 로직은 미구현이다.
 * 실제 API/YouTube/LLM 요청을 수행하지 않는다.
 */
chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.warn("[YUTOPIA DEMO] Side Panel 초기 설정을 확인하세요:", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "YUTOPIA_DEMO_PING") return;
  sendResponse({ ok: true, demo: true });
});
