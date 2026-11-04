import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAnalysisRepository } from "../analysis/data/AnalysisRepositoryContext";
import {
  filterWorkspaceCatalog, readWorkspaceCatalog,
  type WorkspaceCatalogEntry, type WorkspaceCatalogFilters,
} from "./analysisWorkspaceCatalog";
import { type AnalysisWorkspaceSession, type WorkspacePairKind,
  ANALYSIS_WORKSPACE_TOPICS } from "./analysisWorkspaceSession";

type Props = Readonly<{
  session: AnalysisWorkspaceSession;
  onSelect: (field: WorkspacePairKind, index: 0 | 1, id: string) => void;
}>;

type CatalogState = Readonly<{
  repository: ReturnType<typeof useAnalysisRepository>;
  entries: readonly WorkspaceCatalogEntry[] | null;
  failed: boolean;
}>;

/**
 * YU-53: independent verified summary of selected synthetic objects.
 * YU-54: searchable fixture catalogue using validated statuses and topics.
 * Never add two channels' denominators, infer audience membership, or
 * treat missing/blocked data as a zero-valued analysis.
 */
export function WorkspaceDiscoveryPanels({session, onSelect}: Props) {
  const repository = useAnalysisRepository();
  const [state, setState] = useState<CatalogState | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<WorkspaceCatalogFilters["kind"]>("ALL");
  const [status, setStatus] = useState<WorkspaceCatalogFilters["status"]>("ALL");
  const [topic, setTopic] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState({repository,entries:null,failed:false});
    void readWorkspaceCatalog(repository).then(entries => {
      if (!cancelled) setState({repository,entries,failed:false});
    }).catch(() => {
      if (!cancelled) setState({repository,entries:null,failed:true});
    });
    return () => {cancelled = true;};
  }, [repository]);

  const loaded = state?.repository === repository ? state : null;
  const entries = loaded?.entries ?? null;
  const filtered = entries ? filterWorkspaceCatalog(entries,{search,kind,status,topic}) : [];
  const selected = (slotKind: "VIDEO" | "CHANNEL", id: string) =>
    entries?.find(e => e.kind === slotKind && e.id === id);

  function renderSelection(
    slotKind: "VIDEO" | "CHANNEL",
    id: string,
    label: string,
  ) {
    if (!id) return <li key={label}><strong>{label}</strong><span>미선택 · 수치 없음</span></li>;
    const entry = selected(slotKind, id);
    if (!entry) return (
      <li key={label}><strong>{label}</strong><span>상태 확인 중 · 수치 미표시</span></li>
    );
    return (
      <li key={label}>
        <strong>{label} · {entry.id}</strong>
        <span>상태: {entry.status}{entry.reason ? " · " + entry.reason : ""}</span>
        {entry.classified !== null && entry.positivePercent !== null ? (
          <span>분류 완료 {entry.classified}건 · 긍정 {entry.positivePercent.toFixed(2)}%
            (분류 완료 표본 기준, 합성)</span>
        ) : <span>검증된 감성 분모 미제공</span>}
      </li>
    );
  }

  const topicCounts = session.topicId ? session.channelIds.map((id,index) => (
    id ? {id,index,entry:selected("CHANNEL",id)} : null
  )).filter((part): part is NonNullable<typeof part> => part !== null).map(part => ({
    id:part.id, index:part.index,
    value:part.entry?.status === "READY"
      ? part.entry.topics.find(t => t.id === session.topicId)?.count ?? 0
      : null,
  })) : [];

  return (
    <>
      <section className="analysis-workspace__panel" aria-label="통합 분석 요약">
        <div className="analysis-workspace__heading">
          <div>
            <h2>선택 대상 통합 요약</h2>
            <p>검증된 합성 스냅샷별 결과만 요약합니다. 영상·채널의 표본을 서로 합산하지 않습니다.</p>
          </div>
        </div>
        {!entries ? (
          <p role="status">{loaded?.failed
            ? "등록 합성 분석 정보를 확인하지 못했습니다. 요약 수치를 표시하지 않습니다."
            : "선택 대상의 근거와 상태를 검증하고 있습니다."}</p>
        ) : (
          <>
            <div className="analysis-workspace__summary-grid">
              <div>
                <h3>선택 영상</h3>
                <ul aria-label="선택 영상 요약">
                  {renderSelection("VIDEO",session.videoIds[0],"영상 A")}
                  {renderSelection("VIDEO",session.videoIds[1],"영상 B")}
                </ul>
              </div>
              <div>
                <h3>선택 채널 · 선정 합성 집합</h3>
                <ul aria-label="선택 채널 요약">
                  {renderSelection("CHANNEL",session.channelIds[0],"채널 A")}
                  {renderSelection("CHANNEL",session.channelIds[1],"채널 B")}
                </ul>
              </div>
            </div>
            <div className="analysis-workspace__topic-summary">
              <h3>선택 주제: {session.topicId || "미선택"}</h3>
              {!session.topicId || topicCounts.length === 0 ? (
                <p>주제 또는 채널을 선택하면 검증된 선정 영상의 언급 건수를 표시합니다.</p>
              ) : (
                <ul aria-label="선정 채널별 주제 언급량">
                  {topicCounts.map(part => (
                    <li key={part.id}>
                      <strong>채널 {part.index === 0 ? "A" : "B"}</strong>
                      <span>{part.value === null ? "주제 근거 미제공" :
                        part.value + "건 (검증된 선정 합성 영상)"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="analysis-workspace__notice">
              READY만 전체 검증된 합성 비교에 사용할 수 있습니다. PARTIAL은 일부 표본,
              STALE·BLOCKED는 수치 차단입니다. 주제는 다중 라벨이며
              두 채널의 비교 가능 조건은 기존 채널 비교 화면에서 별도 검증합니다.
            </p>
          </>
        )}
      </section>

      <section id="workspace-catalog" className="analysis-workspace__panel" aria-label="분석 대상 검색">
        <div className="analysis-workspace__heading">
          <div>
            <h2>등록 합성 대상 검색·필터</h2>
            <p>등록 VIDEO 4개 / CHANNEL 2개만 대상으로 합니다.
              유효한 스냅샷이 없는 대상을 READY로 추정하지 않습니다.</p>
          </div>
        </div>
        <div className="analysis-workspace__filters">
          <label>
            ID·이름 검색
            <input aria-label="ID·이름 검색" type="search" value={search}
              maxLength={80} onChange={event => setSearch(event.target.value)}
              placeholder="예: Ab0_ / 채널 B"/>
          </label>
          <label>
            대상 종류
            <select value={kind} onChange={event =>
              setKind(event.target.value as WorkspaceCatalogFilters["kind"])}>
              <option value="ALL">전체 종류</option>
              <option value="VIDEO">VIDEO</option>
              <option value="CHANNEL">CHANNEL</option>
            </select>
          </label>
          <label>
            분석 상태
            <select value={status} onChange={event =>
              setStatus(event.target.value as WorkspaceCatalogFilters["status"])}>
              <option value="ALL">전체 상태</option>
              <option value="READY">READY</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="STALE">STALE</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </label>
          <label>
            주제 언급
            <select value={topic} onChange={event => setTopic(event.target.value)}>
              <option value="">모든 주제</option>
              {ANALYSIS_WORKSPACE_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => {
            setSearch("");setKind("ALL");setStatus("ALL");setTopic("");
          }}>검색 필터 초기화</button>
        </div>
        {!entries ? (
          <p role="status">{loaded?.failed
            ? "카탈로그 조회 실패 · 결과를 제공하지 않습니다."
            : "등록된 합성 분석 대상의 상태를 확인하고 있습니다."}</p>
        ) : (
          <>
            <p role="status">검색 결과 {filtered.length}개 / 등록 {entries.length}개</p>
            {filtered.length === 0 ? (
              <p>현재 검색 조건과 일치하는 검증 대상이 없습니다. 미등록 대상을 자동 생성하지 않습니다.</p>
            ) : (
              <ul className="analysis-workspace__catalog" aria-label="등록 합성 분석 대상 목록">
                {filtered.map(entry => {
                  const field = entry.kind === "VIDEO" ? "videoIds" : "channelIds";
                  return (
                    <li key={entry.kind + ":" + entry.id}>
                      <div>
                        <strong>{entry.label}</strong>
                        <code>{entry.id}</code>
                        <span>종류 {entry.kind} · 상태 {entry.status}
                          {entry.reason ? " (" + entry.reason + ")" : ""}</span>
                        {entry.classified !== null ? (
                          <span>분류 완료 {entry.classified}건 · 합성 데이터</span>
                        ) : <span>검증된 분모 미제공</span>}
                      </div>
                      <div className="analysis-workspace__catalog-actions">
                        <Link to={entry.href}>{entry.kind === "VIDEO" ? "영상 상세 열기" : "채널 상세 열기"}</Link>
                        {([0,1] as const).map(index => (
                          <button type="button" key={index}
                            disabled={session[field][1-index] === entry.id}
                            onClick={() => onSelect(field,index,entry.id)}>
                            {index === 0 ? "A" : "B"}에 선택
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
