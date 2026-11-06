import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { demoChannelSelections } from "../../features/analysis/data/demoChannelSelection";
import { WorkspaceDiscoveryPanels } from "../../features/analysis-workspace/WorkspaceDiscoveryPanels";
import { WorkspaceHero } from "../../features/analysis-workspace/WorkspaceHero";
import { WorkspaceUrlTargetBoard } from "../../features/analysis-workspace/WorkspaceUrlTargetBoard";
import { readFocusDockLayout } from "../../features/analysis-workspace/workspaceFocusLayout";
import {
  chooseWorkspaceDockTarget, createWorkspaceDockState,
  reconcileWorkspaceDockState,
} from "../../features/analysis-workspace/workspaceDockState";
import { workspaceDiagnosticsEnabled } from "../../features/analysis-workspace/workspaceDiagnosticsGate";
import { ApprovedChannelProfileCache } from "../../features/analysis-workspace/workspaceChannelProfile";
import { createOfflineWorkspacePreview, type SyntheticWorkspaceMetadata } from "../../features/analysis-workspace/workspaceSyntheticMetadata";
import { fetchSyntheticHttpMetadata, syntheticHttpDevEnabled } from "../../features/analysis-workspace/workspaceSyntheticHttpClient";
import { fetchMetadataStateHttp, metadataStateDevEnabled } from "../../features/analysis-workspace/workspaceMetadataStateHttpClient";
import { EMPTY_METADATA_STATE, InMemoryMetadataStateCache,
  pendingMetadataState, type MetadataState, type StateScenario,
} from "../../features/analysis-workspace/workspaceMetadataConsumerState";
import {
  decodeProviderMetadata, unavailableProviderState,
  PROVIDER_METADATA_BATCH_LIMIT, type ProviderMetadataReader,
  type ProviderMetadataState,
} from "../../features/analysis-workspace/workspaceProviderMetadata";
import {
  readTargetPresentation, reconcileTargetPresentation, writeTargetPresentation,
  withUserLabel, withChannelArtwork,
  type WorkspaceTargetPresentation,
} from "../../features/analysis-workspace/workspaceTargetPresentation";
import {
  addWorkspaceUrlTargets, clearWorkspaceUrlTargets, readWorkspaceUrlTargets,
  workspaceUrlTargetKey, writeWorkspaceUrlTargets,
  type WorkspaceUrlTarget,
} from "../../features/analysis-workspace/workspaceUrlTargets";
import { applyWorkspacePreset, WORKSPACE_PRESETS } from "../../features/analysis-workspace/analysisWorkspacePresets";
import { withoutAllowedUtmTracking } from "../../features/analysis-target/analysisQueryTracking";
import {
  ANALYSIS_WORKSPACE_SESSION_KEY,
  ANALYSIS_WORKSPACE_TOPICS,
  buildWorkspacePaths,
  clearWorkspaceSession,
  createDefaultWorkspaceSession,
  readWorkspaceSession,
  withWorkspacePair,
  withWorkspaceTopic,
  writeWorkspaceSession,
  type AnalysisWorkspaceSession,
  type WorkspacePairKind,
} from "../../features/analysis-workspace/analysisWorkspaceSession";
import {
  ChannelWorkspaceEvidence,
  VideoWorkspaceEvidence,
} from "../../features/analysis-workspace/AnalysisWorkspaceEvidence";

import "./analysis-workspace.css";

const fixtureVideos = [...new Set(demoChannelSelections.flatMap(channel => channel.videoIds))];

function getTabStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * YU-50: Existing VIDEO, CHANNEL and TOPIC analysis routes in one screen.
 * YU-51: Only bounded synthetic IDs and selection order enter sessionStorage.
 * YU-52: All metrics are delegated to verified existing repository projections.
 */
function loadInitialSession(): { value: AnalysisWorkspaceSession; status: string } {
  const storage = getTabStorage();
  const restored = readWorkspaceSession(storage);
  if (restored) return {
    value: restored,
    status: "유효한 이전 작업 세션을 복원했습니다. 이 탭에서 계속 편집할 수 있습니다.",
  };
  let existing = false;
  try { existing = storage?.getItem(ANALYSIS_WORKSPACE_SESSION_KEY) != null; }
  catch { /* A disabled storage never becomes a trusted session. */ }
  return {
    value: createDefaultWorkspaceSession(),
    status: existing
      ? "이전 세션이 만료되었거나 검증에 실패해 복원하지 않았습니다. 등록 합성 기본값만 표시합니다."
      : "등록된 합성 데모만 선택할 수 있습니다. 변경은 이 탭의 임시 세션에 보관됩니다.",
  };
}

export function AnalysisWorkspacePage({
  diagnosticsMode = false, providerMetadataReader,
}: Readonly<{
  diagnosticsMode?: boolean;
  /** No reader is registered by product routes. A future authorized backend
   *  may be injected only after a separately approved transport review. */
  providerMetadataReader?: ProviderMetadataReader;
}> = {}) {
  // The regular product route never exposes or executes test controls, even
  // when the developer has enabled synthetic servers in the same Vite process.
  const diagnosticAccess = diagnosticsMode && workspaceDiagnosticsEnabled();
  const location = useLocation();
  const [initial] = useState(loadInitialSession);
  const [session, setSession] = useState<AnalysisWorkspaceSession>(initial.value);
  const [feedback, setFeedback] = useState(initial.status);
  const [urlTargets, setUrlTargets] = useState<readonly WorkspaceUrlTarget[]>(
    () => readWorkspaceUrlTargets(getTabStorage()),
  );
  // One selection/open-docks/widths model for graph, focus list and fallback
  // registered-target board. The former board is hidden while focus is open.
  const [focusOpen, setFocusOpen] = useState(true);
  const [dockState, setDockState] = useState(() =>
    createWorkspaceDockState(readFocusDockLayout(getTabStorage())));
  useEffect(() => {
    setDockState(previous => reconcileWorkspaceDockState(previous,urlTargets));
  }, [urlTargets]);
  // Explicit per-page opt-in; never persisted or inferred from URL registration.
  const [allowVideoImage, setAllowVideoImage] = useState(false);
  const [allowChannelImage, setAllowChannelImage] = useState(false);
  // Explicit local-only synthetic preview, never persisted or fetched.
  const [syntheticPreviewEnabled, setSyntheticPreviewEnabled] = useState(false);
  const syntheticServerAvailable = diagnosticAccess && syntheticHttpDevEnabled();
  const [syntheticServerEnabled, setSyntheticServerEnabled] = useState(false);
  const [syntheticServerRecords, setSyntheticServerRecords] = useState<
    Readonly<Record<string, SyntheticWorkspaceMetadata>>
  >({});
  const [syntheticServerStatus, setSyntheticServerStatus] = useState(
    "테스트 전용 Spring 서버 합성 조회 대기",
  );
  // Status-contract demo is independent of provider data and opt-in only.
  const stateDemoAvailable = diagnosticAccess && metadataStateDevEnabled();
  const [stateDemoEnabled, setStateDemoEnabled] = useState(false);
  const [stateScenario, setStateScenario] = useState<StateScenario>("READY");
  const [stateRefresh, setStateRefresh] = useState(0);
  const [stateRecords, setStateRecords] = useState<Readonly<Record<string, MetadataState>>>({});
  const [stateCache] = useState(() => new InMemoryMetadataStateCache());
  // UI-R04-AE: this optional integration seam does not create a fetch
  // endpoint. The normal product route passes no reader, hence zero calls.
  const [providerRecords, setProviderRecords] = useState<
    Readonly<Record<string, ProviderMetadataState>>
  >({});
  useEffect(() => {
    if (!providerMetadataReader) return;
    const controller = new AbortController();
    const chosen = urlTargets.slice(0,PROVIDER_METADATA_BATCH_LIMIT);
    setProviderRecords(Object.fromEntries(chosen.map(target => [
      workspaceUrlTargetKey(target), unavailableProviderState(target),
    ])));
    void (async () => {
      for (const target of chosen) {
        if (controller.signal.aborted) return;
        let raw: unknown = null;
        try { raw = await providerMetadataReader(target,controller.signal); }
        catch { /* Missing/invalid backend data never becomes a fake READY. */ }
        if (controller.signal.aborted) return;
        const decoded = decodeProviderMetadata(raw,target,true);
        setProviderRecords(previous => ({
          ...previous, [workspaceUrlTargetKey(target)]:
            decoded ?? unavailableProviderState(target,"FAILED"),
        }));
      }
    })();
    return () => controller.abort();
  }, [providerMetadataReader, urlTargets]);
  const [presentation, setPresentation] = useState<WorkspaceTargetPresentation>(
    () => readTargetPresentation(getTabStorage(), urlTargets),
  );
  useEffect(() => {
    const reconciled = reconcileTargetPresentation(presentation, urlTargets);
    if (reconciled !== presentation) { setPresentation(reconciled); return; }
    writeTargetPresentation(getTabStorage(), presentation, urlTargets);
  }, [presentation, urlTargets]);
  const [showEvidence, setShowEvidence] = useState(false);
  // Empty until a separately authorized, reviewed channel metadata reader exists.
  // The cache is in-memory only and never triggers network calls.
  const [channelProfiles] = useState(() => new ApprovedChannelProfileCache());
  // A server failure NEVER falls back to a guessed title or locally mocked
  // provider result. The two synthetic modes are independent and opt-in only.
  useEffect(() => {
    if (!syntheticServerAvailable || !syntheticServerEnabled) {
      setSyntheticServerRecords({});
      return;
    }
    const controller = new AbortController();
    const selected = urlTargets.slice(0, 3); // Synthetic test budget: <=3 GETs.
    setSyntheticServerRecords({});
    if (selected.length === 0) {
      setSyntheticServerStatus("URL을 추가하면 로컬 Spring 테스트 서버에 합성 조회합니다.");
      return () => controller.abort();
    }
    setSyntheticServerStatus("Spring 루프백 합성 서버 응답 확인 중");
    void (async () => {
      const verified: Record<string, SyntheticWorkspaceMetadata> = {};
      let failed = 0;
      for (const target of selected) {
        if (controller.signal.aborted) return;
        const response = await fetchSyntheticHttpMetadata(target, controller.signal);
        if (response) verified[workspaceUrlTargetKey(target)] = response;
        else failed++;
      }
      if (controller.signal.aborted) return;
      setSyntheticServerRecords(verified);
      setSyntheticServerStatus(
        "Spring 테스트 서버 합성 응답 " + Object.keys(verified).length + "개 확인" +
        (failed ? " · " + failed + "개 실패(미확인 유지)" : "") +
        (urlTargets.length > 3 ? " · 상한 3개까지만 시험" : "") +
        " · 실제 YouTube 조회 0건",
      );
    })();
    return () => controller.abort();
  }, [syntheticServerAvailable, syntheticServerEnabled, urlTargets]);

  useEffect(() => {
    if (!stateDemoAvailable || !stateDemoEnabled) {
      setStateRecords({});
      return;
    }
    const abort = new AbortController();
    const chosen = urlTargets.slice(0, 3);
    const initial: Record<string, MetadataState> = {};
    for (const target of chosen) {
      initial[workspaceUrlTargetKey(target)] =
        stateScenario === "READY" ? stateCache.get(target) ?? pendingMetadataState()
          : pendingMetadataState();
    }
    setStateRecords(initial);
    void (async () => {
      for (const target of chosen) {
        if (abort.signal.aborted) return;
        const key = workspaceUrlTargetKey(target);
        if (initial[key].status === "READY" || initial[key].status === "STALE") continue;
        const fetched = await fetchMetadataStateHttp(target,stateScenario,abort.signal);
        if (abort.signal.aborted) return;
        const result: MetadataState = fetched ??
          {...EMPTY_METADATA_STATE,status:"FAILED",reason:"CONTRACT_OR_NETWORK_FAILURE"};
        if (result.status === "READY") stateCache.put(target,result);
        setStateRecords(current => ({...current,[key]:result}));
      }
    })();
    return () => abort.abort();
  }, [stateDemoAvailable,stateDemoEnabled,stateScenario,stateRefresh,urlTargets,stateCache]);

  const stateReadyRecords: Record<string, SyntheticWorkspaceMetadata> = {};
  for (const [key,value] of Object.entries(stateRecords)) {
    if (stateDemoEnabled && value.status === "READY" && value.record)
      stateReadyRecords[key] = value.record;
  }
  const providerPresentation: WorkspaceTargetPresentation = providerMetadataReader
    ? { ...presentation, providerStates: providerRecords } : presentation;
  const displayedPresentation: WorkspaceTargetPresentation = diagnosticAccess && stateDemoEnabled
    ? { ...providerPresentation, synthetic: stateReadyRecords, metadataStates: stateRecords }
    : diagnosticAccess && syntheticServerEnabled
      ? { ...providerPresentation, synthetic: syntheticServerRecords }
      : diagnosticAccess && syntheticPreviewEnabled
        ? { ...providerPresentation, synthetic: createOfflineWorkspacePreview(urlTargets) }
        : providerPresentation;
  const paths = buildWorkspacePaths(session);
  const safeQuery = withoutAllowedUtmTracking(new URLSearchParams(location.search));

  function persist(next: AnalysisWorkspaceSession) {
    setSession(next);
    const ok = writeWorkspaceSession(getTabStorage(), next);
    setFeedback(ok
      ? "작업 구성을 이 브라우저 탭에 보관했습니다. 페이지를 다시 열면 복원됩니다."
      : "브라우저 세션 저장소를 사용할 수 없습니다. 현재 화면에서만 선택을 유지합니다.");
  }

  function addUrlTargets(raw: string) {
    const result = addWorkspaceUrlTargets(urlTargets, raw);
    if (result.added.length > 0) {
      const newest=workspaceUrlTargetKey(result.added[result.added.length-1]);
      setDockState(previous =>
        chooseWorkspaceDockTarget(previous,newest,result.targets));
      if (!focusOpen) setFocusOpen(true);
      setUrlTargets(result.targets);
      const stored = writeWorkspaceUrlTargets(getTabStorage(), result.targets);
      if (!stored) {
        setFeedback("URL 등록은 화면에 반영됐지만 탭 저장소에는 보관하지 못했습니다.");
      }
    }
    return result;
  }

  function removeUrlTarget(key: string) {
    const remaining=urlTargets.filter(target => workspaceUrlTargetKey(target) !== key);
    setDockState(previous => reconcileWorkspaceDockState(previous,remaining));
    for (const target of urlTargets) {
      if (workspaceUrlTargetKey(target) === key) stateCache.invalidate(target);
    }
    const next = remaining;
    setUrlTargets(next);
    if (!writeWorkspaceUrlTargets(getTabStorage(), next)) {
      setFeedback("등록 목록 변경을 임시 저장소에 기록하지 못했습니다.");
    }
  }

  function clearUrlTargetList() {
    setDockState(previous => reconcileWorkspaceDockState(previous,[]));
    stateCache.clear();
    setUrlTargets([]);
    if (!clearWorkspaceUrlTargets(getTabStorage())) {
      setFeedback("URL 등록 목록을 화면에서 비웠지만 저장소 삭제는 확인되지 않았습니다.");
    }
  }

  function selectPair(field: WorkspacePairKind, index: 0 | 1, value: string) {
    const next = withWorkspacePair(session, field, index, value);
    if (!next) {
      setFeedback("등록된 합성 ID만 선택하며 A/B에 동일한 대상을 중복 지정할 수 없습니다.");
      return;
    }
    persist(next);
  }

  function swapPair(field: WorkspacePairKind) {
    const [a, b] = session[field];
    if (!a || !b) return;
    persist({
      ...session,
      savedAt: Date.now(),
      [field]: [b, a],
    });
  }

  function selectTopic(topicId: string) {
    const next = withWorkspaceTopic(session, topicId);
    if (!next) {
      setFeedback("등록되지 않은 주제 ID는 작업 세션에 보관하지 않습니다.");
      return;
    }
    persist(next);
  }

  function restore() {
    const saved = readWorkspaceSession(getTabStorage());
    if (!saved) {
      setFeedback("유효한 저장 세션이 없습니다. 기간이 만료되었거나 저장되지 않았습니다.");
      return;
    }
    setSession(saved);
    setFeedback("이 탭에서 검증된 분석 구성을 복원했습니다.");
  }

  function clear() {
    const removed = clearWorkspaceSession(getTabStorage());
    setSession(createDefaultWorkspaceSession());
    setFeedback(removed
      ? "작업 세션을 삭제했습니다. 등록 합성 데모의 기본 선택만 표시합니다."
      : "저장소의 삭제 여부를 확인할 수 없습니다. 화면은 기본 선택으로 초기화했습니다.");
  }

  // The workspace has no application query contract. Never silently discard
  // unknown/duplicate parameters and show the default demo as if valid.
  // Recognized bounded UTM attribution is the only permitted exception.
  if (!safeQuery || [...safeQuery.keys()].length > 0) {
    return (
      <div className="product-screen analysis-workspace">
        <header className="product-heading"><h1>통합 분석 워크스페이스</h1></header>
        <section className="analysis-workspace__panel">
          <p role="alert">지원하지 않는 URL 매개변수입니다.
            분석 구성은 URL에서 복원하지 않으며 임의 매개변수를 무시하지 않습니다.</p>
          <Link to="/analysis/youtube/workspace">기본 워크스페이스로 이동</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="product-screen analysis-workspace">
      <WorkspaceHero diagnosticsMode={diagnosticAccess}
        focusOpen={focusOpen} onFocusOpenChange={setFocusOpen}
        dockState={dockState} onDockStateChange={setDockState}
        onClearTargetList={clearUrlTargetList}
        targets={urlTargets} onAddUrls={addUrlTargets}
        onRemoveTarget={removeUrlTarget} allowVideoImage={allowVideoImage}
        onToggleVideoImage={() => setAllowVideoImage(enabled => !enabled)}
        allowChannelImage={allowChannelImage}
        onToggleChannelImage={() => setAllowChannelImage(enabled => !enabled)}
        channelProfiles={channelProfiles} defaultFocusMode
        syntheticPreviewEnabled={diagnosticAccess && syntheticPreviewEnabled}
        onToggleSyntheticPreview={diagnosticAccess ? () => {
          setSyntheticServerEnabled(false);
          setStateDemoEnabled(false);
          setSyntheticPreviewEnabled(v => !v);
        } : undefined}
        syntheticServerAvailable={syntheticServerAvailable}
        syntheticServerEnabled={syntheticServerEnabled}
        syntheticServerStatus={syntheticServerStatus}
        onToggleSyntheticServer={diagnosticAccess ? () => {
          setSyntheticPreviewEnabled(false);
          setStateDemoEnabled(false);
          setSyntheticServerEnabled(v => !v);
        } : undefined}
        stateDemoAvailable={stateDemoAvailable}
        stateDemoEnabled={diagnosticAccess && stateDemoEnabled}
        stateScenario={stateScenario}
        onStateScenarioChange={diagnosticAccess ? scenario => {
          stateCache.clear();
          setStateScenario(scenario);
        } : undefined}
        onToggleStateDemo={diagnosticAccess ? () => {
          setSyntheticPreviewEnabled(false);
          setSyntheticServerEnabled(false);
          setStateDemoEnabled(v => !v);
        } : undefined}
        onRefreshStateDemo={diagnosticAccess ? () => {
          stateCache.clear();
          setStateRefresh(v => v + 1);
        } : undefined}
        presentation={displayedPresentation}
        onSetTargetLabel={(key, value) => {
          const next = withUserLabel(presentation, urlTargets, key, value);
          setPresentation(next);
          return next !== presentation;
        }}
        onSetChannelArtwork={(key, value) => {
          const next = withChannelArtwork(presentation, urlTargets, key, value);
          setPresentation(next);
          return next !== presentation;
        }}/>
      {!focusOpen && (
        <WorkspaceUrlTargetBoard targets={urlTargets} onRemove={removeUrlTarget}
          onClear={clearUrlTargetList} allowVideoImage={allowVideoImage}
          allowChannelImage={allowChannelImage} presentation={displayedPresentation}
          selectedKey={dockState.selectedKey}
          onSelectTarget={key => {
            setDockState(previous => chooseWorkspaceDockTarget(
              previous,key,urlTargets));
            setFocusOpen(true);
          }}
          channelProfiles={channelProfiles} />
      )}

      <div className="analysis-workspace__layout">
        <div className="analysis-workspace__main">
          <section id="workspace-session" className="analysis-workspace__panel" aria-label="분석 작업 세션">
        <div className="analysis-workspace__heading">
          <div>
            <h2>분석 대상과 비교 구성</h2>
            <p>이 탭의 임시 선택 상태 · 최대 2시간 · 계정/클라우드 동기화 없음</p>
          </div>
          <div className="analysis-workspace__actions">
            <button type="button" onClick={restore}>저장한 구성 복원</button>
            <button type="button" onClick={clear}>작업 세션 삭제</button>
          </div>
        </div>
        <p role="status" className="analysis-workspace__feedback">{feedback}</p>
        <section className="analysis-workspace__presets" aria-label="작업 구성 프리셋">
          <h3>고정 합성 작업 프리셋</h3>
          <p>등록된 합성 대상의 작업 구성만 전환합니다. 최근 선택 이력은 유지합니다.</p>
          <div className="analysis-workspace__preset-options">
            {WORKSPACE_PRESETS.map(preset => (
              <button key={preset.id} type="button" onClick={() => {
                const next = applyWorkspacePreset(session, preset.id);
                if (next) persist(next);
                else setFeedback("허용되지 않는 프리셋입니다. 작업 구성을 변경하지 않았습니다.");
              }}>
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="analysis-workspace__grid">
          <section className="analysis-workspace__group" aria-label="영상 선택">
            <h3>영상 · A/B</h3>
            {([0, 1] as const).map(index => (
              <label key={index}>
                영상 {index === 0 ? "A" : "B"}
                <select value={session.videoIds[index]}
                  onChange={event => selectPair("videoIds", index, event.target.value)}>
                  <option value="">선택하지 않음</option>
                  {fixtureVideos.map(id => (
                    <option key={id} value={id}
                      disabled={id === session.videoIds[1 - index]}>{id}</option>
                  ))}
                </select>
              </label>
            ))}
            <button type="button" disabled={!session.videoIds[0] || !session.videoIds[1]}
              onClick={() => swapPair("videoIds")}>영상 A/B 순서 교환</button>
          </section>

          <section className="analysis-workspace__group" aria-label="채널 선택">
            <h3>선정 합성 채널 · A/B</h3>
            {([0, 1] as const).map(index => (
              <label key={index}>
                채널 {index === 0 ? "A" : "B"}
                <select value={session.channelIds[index]}
                  onChange={event => selectPair("channelIds", index, event.target.value)}>
                  <option value="">선택하지 않음</option>
                  {demoChannelSelections.map(channel => (
                    <option key={channel.channelId} value={channel.channelId}
                      disabled={channel.channelId === session.channelIds[1 - index]}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="button" disabled={!session.channelIds[0] || !session.channelIds[1]}
              onClick={() => swapPair("channelIds")}>채널 A/B 순서 교환</button>
          </section>

          <section className="analysis-workspace__group" aria-label="주제 선택">
            <h3>주제 심층 탐색</h3>
            <label>
              주제 ID
              <select value={session.topicId}
                onChange={event => selectTopic(event.target.value)}>
                <option value="">선택하지 않음</option>
                {ANALYSIS_WORKSPACE_TOPICS.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </label>
            <p>주제별 값은 선정 영상에서 확인된 언급 건수입니다.
              주제의 합계는 고유 댓글 수가 아닙니다.</p>
          </section>
        </div>
      </section>

      <WorkspaceDiscoveryPanels session={session} onSelect={selectPair} />

      <section className="analysis-workspace__panel" aria-label="통합 분석 바로가기">
        <h2>분석 상세 보기</h2>
        <nav className="analysis-workspace__links" aria-label="분석 바로가기">
          {paths.videoDetail && <Link to={paths.videoDetail}>영상 A 상세 분석</Link>}
          {paths.videoCompare && <Link to={paths.videoCompare}>영상 A/B 비교 화면</Link>}
          {paths.channelDetail && <Link to={paths.channelDetail}>채널 A 선정 집합 상세</Link>}
          {paths.channelCompare && <Link to={paths.channelCompare}>채널 A/B 비교 화면</Link>}
          {paths.topicExplorer && <Link to={paths.topicExplorer}>선택 주제 심층 탐색</Link>}
        </nav>
        {(!paths.videoCompare || !paths.channelCompare || !paths.topicExplorer) && (
          <p role="note">선택이 비어 있는 기능은 링크를 생성하지 않습니다.
            A/B 비교는 서로 다른 두 대상을 선택해야 하며
            데이터·관측 범위 검증은 이동한 분석 화면에서 수행합니다.</p>
        )}
      </section>

        </div>
        <aside className="analysis-workspace__rail" aria-label="워크스페이스 최근 선택 및 근거">
          <section className="analysis-workspace__panel" aria-label="최근 분석 대상">
        <h2>최근 선택한 대상</h2>
        {session.recentTargets.length === 0 ? (
          <p>아직 이 작업 세션에서 변경한 대상이 없습니다.</p>
        ) : (
          <ol className="analysis-workspace__recent">
            {session.recentTargets.map(target => (
              <li key={target.type + ":" + target.id}>
                <span>{target.type === "VIDEO" ? "영상" : "채널"}</span>
                <Link to={target.type === "VIDEO"
                  ? "/analysis/youtube/video/" + target.id
                  : "/analysis/youtube/channel/" + target.id}>
                  {target.id}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

          <section id="workspace-evidence" className="analysis-workspace__panel" aria-label="데이터 범위">
        <div className="analysis-workspace__heading">
          <div>
            <h2>데이터 범위</h2>
            <p>현재 표시되는 예시 분석의 표본과 적용 범위를 확인할 수 있습니다.</p>
          </div>
          <button type="button" aria-expanded={showEvidence}
            aria-controls="workspace-evidence-details"
            onClick={() => setShowEvidence(value => !value)}>
            {showEvidence ? "데이터 범위 접기" : "데이터 범위 보기"}
          </button>
        </div>
        <div id="workspace-evidence-details" hidden={!showEvidence}>
          {showEvidence && (
            <>
              <p>표시되는 수치는 등록된 예시 표본에 한정됩니다.
                실제 YouTube 전체 반응이나 채널의 전체 시청자를 대표하지 않습니다.</p>
              <div className="analysis-workspace__evidence-grid">
                <VideoWorkspaceEvidence videoId={session.videoIds[0]} />
                <ChannelWorkspaceEvidence channelId={session.channelIds[0]} />
              </div>
            </>
          )}
        </div>
      </section>

        </aside>
      </div>

      <p className="analysis-workspace__notice">
        현재 표시되는 분석 결과는 예시 데이터입니다.
        URL을 추가해도 실제 YouTube 댓글을 수집하거나 분석하지 않습니다.
      </p>
    </div>
  );
}
