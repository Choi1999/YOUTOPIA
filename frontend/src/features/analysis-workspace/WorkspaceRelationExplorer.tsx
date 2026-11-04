import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import type { WorkspaceCatalogEntry } from "./analysisWorkspaceCatalog";
import {
  buildWorkspacePaths,
  type AnalysisWorkspaceSession,
  type WorkspacePairKind,
} from "./analysisWorkspaceSession";
import {
  buildWorkspaceRelationGraph,
  relationNodeKey,
  type RelationEdge,
  type RelationNode,
} from "./workspaceRelationGraph";

type Props = Readonly<{
  entries: readonly WorkspaceCatalogEntry[];
  session: AnalysisWorkspaceSession;
  onSelect: (field: WorkspacePairKind, index: 0 | 1, id: string) => void;
}>;

function curve(edge: RelationEdge, index: ReadonlyMap<string, RelationNode>) {
  const start = index.get(edge.source);
  const end = index.get(edge.target);
  if (!start || !end) return "";
  const bend = (end.y - start.y) * .48;
  return "M " + start.x + " " + (start.y + 28) +
    " C " + start.x + " " + (start.y + 28 + bend) +
    ", " + end.x + " " + (end.y - 28 - bend) +
    ", " + end.x + " " + (end.y - 28);
}

/**
 * UI-R04-A — Data-grounded SVG 2.5D map with an HTML keyboard/touch fallback.
 * This is a topological diagram: node placement, projected depth, distances
 * and color do NOT represent sentiment, similarity, influence or confidence.
 * Results come solely from the validated synthetic catalogue.
 */
export function WorkspaceRelationExplorer({entries, session, onSelect}: Props) {
  const graph = buildWorkspaceRelationGraph(session, entries);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const active = graph.nodes.find(node => node.key === selectedKey) ??
    graph.nodes.find(node => node.key === relationNodeKey("VIDEO",session.videoIds[0])) ??
    graph.nodes[0] ?? null;
  const paths = buildWorkspacePaths(session);
  const index = new Map(graph.nodes.map(node => [node.key,node]));
  const contributions = active?.kind === "TOPIC"
    ? graph.edges.filter(e => e.type === "VERIFIED_TOPIC_MENTION" &&
      e.target === active.key)
    : [];
  const activeEdges = active
    ? new Set(graph.edges.filter(e =>
      e.source === active.key || e.target === active.key).map(e => e.key))
    : new Set<string>();

  function activateKeyboard(event: KeyboardEvent<SVGGElement>, key: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedKey(key);
    }
  }

  return (
    <section id="workspace-relations" className="analysis-workspace__panel workspace-relations"
      aria-label="합성 관계 탐색">
      <div className="analysis-workspace__heading">
        <div>
          <h2>영상 · 채널 · 주제 관계 탐색</h2>
          <p>등록된 합성 선정 관계와 검증된 주제 언급을 구분해 보여줍니다.
            노드를 선택하면 원래 근거를 확인할 수 있습니다.</p>
        </div>
        <span className="workspace-relations__type">2.5D / VALIDATED SYNTHETIC</span>
      </div>
      <div className="workspace-relations__legend" aria-label="연결선 의미">
        <span><i className="workspace-relations__legend-curated" aria-hidden="true" />
          점선: 수동 등록 합성 선정 관계</span>
        <span><i className="workspace-relations__legend-topic" aria-hidden="true" />
          실선: 검증된 READY 영상의 주제 언급 (1건 이상)</span>
      </div>
      {graph.nodes.length === 0 ? (
        <p role="status">등록된 채널 A 또는 B를 선택하면 합성 관계를 탐색할 수 있습니다.
          선택되지 않은 관계를 임의로 생성하지 않습니다.</p>
      ) : (
        <div className="workspace-relations__layout">
          <div className="workspace-relations__figure">
            <svg viewBox="0 0 700 425" className="workspace-relations__svg"
              aria-label="명시 등록 채널, 영상 및 검증된 주제 간의 관계를 표현한 2.5D 다이어그램">
              <defs>
                <linearGradient id="workspace-graph-surface" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#587ff4" stopOpacity=".21" />
                  <stop offset="100%" stopColor="#60dfd0" stopOpacity=".03" />
                </linearGradient>
              </defs>
              <ellipse cx="350" cy="211" rx="304" ry="167"
                fill="url(#workspace-graph-surface)"
                stroke="currentColor" strokeOpacity=".13" strokeDasharray="4 9"/>
              <path d="M 34 324 L 350 409 L 666 324 M 83 213 L 350 409 L 617 213"
                stroke="currentColor" strokeOpacity=".09" fill="none"/>
              {graph.edges.map(edge => (
                <path key={edge.key} d={curve(edge,index)}
                  className={"workspace-relations__edge" +
                    (edge.type === "CURATED_SET" ? " workspace-relations__edge--curated" : " workspace-relations__edge--topic") +
                    (activeEdges.has(edge.key) ? " is-active" : "")}
                  fill="none" aria-hidden="true" />
              ))}
              {graph.nodes.map(node => (
                <g key={node.key} role="button" tabIndex={0}
                  aria-label={"관계 노드 " + node.kind + " " + node.id}
                  aria-pressed={active?.key === node.key}
                  onClick={() => setSelectedKey(node.key)}
                  onKeyDown={event => activateKeyboard(event,node.key)}
                  className={"workspace-relations__node workspace-relations__node--" + node.kind.toLowerCase() +
                    (active?.key === node.key ? " is-selected" : "") +
                    (node.status === "BLOCKED" || node.status === "STALE" ? " is-blocked" : "")}
                  transform={"translate(" + node.x + " " + node.y + ")"}>
                  <title>{node.label + " · " + node.id + " · " + node.status}</title>
                  <ellipse cy="18" rx="34" ry="11" className="workspace-relations__node-shadow" />
                  <circle r={node.kind === "TOPIC" ? 28 : 26}
                    className="workspace-relations__node-circle" />
                  <text className="workspace-relations__node-letter" textAnchor="middle" dy="5">
                    {node.kind === "CHANNEL" ? "C" : node.kind === "VIDEO" ? "V" : "T"}
                  </text>
                  <text className="workspace-relations__node-label" y="-39" textAnchor="middle">
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="workspace-relations__node-list"
              role="group" aria-label="관계 노드 선택 목록">
              {graph.nodes.map(node => (
                <button key={node.key} type="button"
                  aria-pressed={active?.key === node.key}
                  onClick={() => setSelectedKey(node.key)}>
                  <span>{node.label}</span>
                  <small>{node.status}</small>
                </button>
              ))}
            </div>
            <p className="workspace-relations__footnote">
              위치·거리·깊이는 디자인용 배치이며 통계적 유사도나 영향력을 의미하지 않습니다.
              실제 YouTube 채널 소속으로 해석할 수 없습니다.
            </p>
          </div>
          <aside className="workspace-relations__detail" aria-label="선택 관계 근거">
            <p className="workspace-relations__detail-caption">NODE EVIDENCE / STATIC FIXTURE</p>
            <h3>{active?.label}</h3>
            <p><code>{active?.id}</code></p>
            <p>유형: {active?.kind} · 상태: {active?.status}</p>
            {active?.kind === "TOPIC" ? (
              <>
                <p>현재 선택한 주제와 연결된 검증된 READY 영상의 언급 건수입니다.</p>
                {contributions.length ? (
                  <ul aria-label="주제별 검증 영상 기여">
                    {contributions.map(edge => {
                      const source = index.get(edge.source);
                      return <li key={edge.key}>
                        <span>{source?.id}</span>
                        <strong>{edge.count}건</strong>
                      </li>;
                    })}
                  </ul>
                ) : (
                  <p role="note">검증된 양수 언급 연결이 없습니다.
                    미등록·차단 결과를 0건으로 해석하지 않습니다.</p>
                )}
                {paths.topicExplorer && <Link to={paths.topicExplorer}>주제 근거 상세 열기</Link>}
              </>
            ) : active?.entry?.status === "READY" || active?.entry?.status === "PARTIAL" ? (
              <>
                <dl>
                  <div><dt>분류 완료 분모</dt><dd>{active.entry.classified ?? "미확정"}건</dd></div>
                  <div><dt>긍정 비율</dt><dd>{active.entry.positivePercent?.toFixed(2) ?? "미확정"}%</dd></div>
                </dl>
                <p>관측 기간: {active.entry.observedWindow ?? "미확정"}</p>
                {active.entry.status === "PARTIAL" && (
                  <p role="note">PARTIAL: 확인된 합성 표본에 한정됩니다.</p>
                )}
                <Link to={active.entry.href}>검증된 합성 상세 화면 열기</Link>
              </>
            ) : (
              <p role="status">미등록·차단·오래된 스냅샷은 표본 수치와 감성값을 표시하지 않습니다.
                사유: {active?.entry?.reason ?? "NOT_READY"}</p>
            )}
            {active?.kind === "VIDEO" && (
              <div className="workspace-relations__detail-actions">
                {([0,1] as const).map(slot => (
                  <button key={slot} type="button"
                    disabled={session.videoIds[1-slot] === active.id}
                    onClick={() => onSelect("videoIds",slot,active.id)}>
                    영상 {slot === 0 ? "A" : "B"}에 선택
                  </button>
                ))}
              </div>
            )}
            {active?.kind === "CHANNEL" && (
              <div className="workspace-relations__detail-actions">
                {([0,1] as const).map(slot => (
                  <button key={slot} type="button"
                    disabled={session.channelIds[1-slot] === active.id}
                    onClick={() => onSelect("channelIds",slot,active.id)}>
                    채널 {slot === 0 ? "A" : "B"}에 선택
                  </button>
                ))}
              </div>
            )}
            <p className="workspace-relations__notice">
              점선은 수동 합성 선정 관계만 뜻합니다. 주제 연결은 양수 언급을 검증한
              영상에 한정되며, 연결 부재가 반드시 0건을 뜻하지 않습니다.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
