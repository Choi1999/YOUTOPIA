import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { demoChannelSelections } from "../../features/analysis/data/demoChannelSelection";
import { WorkspaceDiscoveryPanels } from "../../features/analysis-workspace/WorkspaceDiscoveryPanels";
import { WorkspaceHero } from "../../features/analysis-workspace/WorkspaceHero";
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

export function AnalysisWorkspacePage() {
  const location = useLocation();
  const [initial] = useState(loadInitialSession);
  const [session, setSession] = useState<AnalysisWorkspaceSession>(initial.value);
  const [feedback, setFeedback] = useState(initial.status);
  const paths = buildWorkspacePaths(session);
  const safeQuery = withoutAllowedUtmTracking(new URLSearchParams(location.search));

  function persist(next: AnalysisWorkspaceSession) {
    setSession(next);
    const ok = writeWorkspaceSession(getTabStorage(), next);
    setFeedback(ok
      ? "작업 구성을 이 브라우저 탭에 보관했습니다. 페이지를 다시 열면 복원됩니다."
      : "브라우저 세션 저장소를 사용할 수 없습니다. 현재 화면에서만 선택을 유지합니다.");
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
      <WorkspaceHero />

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
        <h2>기존 검증 화면으로 이동</h2>
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

          <section id="workspace-evidence" className="analysis-workspace__panel" aria-label="근거 검토">
        <h2>분석 근거와 처리 표본</h2>
        <p>표본 단계·분류 완료 분모·관측 기간·버전을 원래 합성
          Repository와 검증 Projection을 통해 확인합니다.
          미등록·미검증·오래된 결과를 임의 수치로 보완하지 않습니다.</p>
        <div className="analysis-workspace__evidence-grid">
          <VideoWorkspaceEvidence videoId={session.videoIds[0]} />
          <ChannelWorkspaceEvidence channelId={session.channelIds[0]} />
        </div>
      </section>

        </aside>
      </div>

      <p className="analysis-workspace__notice">
        STATIC FIXTURE · 이 화면은 실제 수집·실시간 분석·장기 저장·구독/결제와
        연결되지 않습니다. 영상·채널의 실제 소속과 전체 여론을 대표하지 않습니다.
      </p>
    </div>
  );
}
