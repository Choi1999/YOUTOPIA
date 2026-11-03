import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { createAnalysisTarget } from "../../features/analysis-target/analysisTarget";
import {
  demoChannelSelections,
} from "../../features/analysis/data/demoChannelSelection";
import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import { readDemoChannelAggregate } from "../../features/analysis/data/readDemoChannelAggregate";
import {
  compareChannelAggregations, type ChannelCompareResult,
} from "../../features/analysis/model/channelComparison";

import "./channel-comparison.css";

type Pair = readonly [string, string];

function getPair(params: URLSearchParams): Pair | null {
  const all = [...params.entries()];
  if (!all.length) {
    return [demoChannelSelections[0].channelId, demoChannelSelections[1].channelId];
  }
  const ids = params.getAll("channel");
  if (all.length !== 2 || ids.length !== 2 ||
      all.some(([key]) => key !== "channel") ||
      ids[0] === ids[1] ||
      !ids.every(id => createAnalysisTarget("CHANNEL", id) !== null)) {
    return null;
  }
  return [ids[0], ids[1]];
}

export function ChannelComparisonPage() {
  const repo = useAnalysisRepository();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const pair = getPair(new URLSearchParams(query));
  const aId = pair?.[0] ?? null;
  const bId = pair?.[1] ?? null;
  const [result, setResult] = useState<ChannelCompareResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setLoading(Boolean(aId && bId));
    if (!aId || !bId) return;
    void Promise.all([
      readDemoChannelAggregate(repo, aId),
      readDemoChannelAggregate(repo, bId),
    ]).then(([a, b]) => {
      if (!cancelled) {
        setResult(compareChannelAggregations(a, b));
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [repo, aId, bId]);

  function select(index: 0 | 1, value: string) {
    const ids: [string, string] = [
      index === 0 ? value : aId ?? "",
      index === 1 ? value : bId ?? "",
    ];
    const next = new URLSearchParams();
    next.append("channel", ids[0]);
    next.append("channel", ids[1]);
    setParams(next);
  }

  function swap() {
    if (!pair) return;
    const next = new URLSearchParams();
    next.append("channel", pair[1]);
    next.append("channel", pair[0]);
    setParams(next);
  }

  const ready = result?.kind === "READY" ? result : null;

  return (
    <div className="product-screen channel-compare">
      <header className="product-heading">
        <div className="channel-compare__eyebrow">YOUTOPIA · STATIC FIXTURE · DEMO</div>
        <h1>채널 A/B 반응 비교</h1>
        <p>명시적으로 등록한 채널별 선정 영상 집합만 비교합니다.
          실제 YouTube 채널 소속, 구독자 의견 또는 전체 시청자 반응이 아닙니다.</p>
      </header>
      <section className="channel-compare__panel" aria-label="비교 채널 선택">
        <div className="channel-compare__selectors">
          {([0, 1] as const).map(index => (
            <label key={index}>
              채널 {index === 0 ? "A" : "B"}
              <select value={pair?.[index] ?? ""}
                onChange={e => select(index, e.target.value)}>
                <option value="" disabled>채널을 선택하세요</option>
                {pair?.[index] && !demoChannelSelections.some(c => c.channelId === pair[index]) && (
                  <option value={pair[index]}>미등록 채널: {pair[index]}</option>
                )}
                {demoChannelSelections.map(channel => (
                  <option key={channel.channelId} value={channel.channelId}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="button" onClick={swap} disabled={!pair}>
            A/B 순서 바꾸기
          </button>
        </div>
        <nav className="channel-compare__links" aria-label="채널 비교 탐색">
          {pair?.map((id, index) => (
            <Link key={id} to={"/analysis/youtube/channel/" + id}>
              채널 {index === 0 ? "A" : "B"} 상세
            </Link>
          ))}
        </nav>
        {!pair ? (
          <p role="alert" className="channel-compare__blocked">
            두 개의 서로 다른 유효한 CHANNEL ID만 비교할 수 있습니다.
            잘못된 공유 URL을 기본 예시의 분석값으로 바꾸지 않습니다.
          </p>
        ) : loading ? (
          <p role="status">선정 영상의 검증된 합성 스냅샷을 조회하고 있습니다.</p>
        ) : !ready ? (
          <p role="status" className="channel-compare__blocked">
            두 채널의 등록된 합성 영상 집합이 모두 READY 상태이고,
            관측 기간·시각·분류 버전이 같아야 비교할 수 있습니다.
            {result?.kind === "BLOCKED" && " 비교 제한: " + result.reason}
          </p>
        ) : (
          <>
            <section className="channel-compare__section"
              aria-labelledby="channel-comparison-evidence">
              <h2 id="channel-comparison-evidence">검증된 집계 범위</h2>
              <p>공통 관측 기간: {ready.left.observationWindow.start} ~ {ready.left.observationWindow.end}</p>
              <p>분석 시각: {ready.left.analyzedAt} · 언어: {ready.left.observationWindow.locale}</p>
              <div className="channel-compare__cards">
                {([ready.left, ready.right] as const).map((c, index) => (
                  <article key={c.channelId}>
                    <strong>채널 {index === 0 ? "A" : "B"}</strong>
                    <code>{c.channelId}</code>
                    <p>선정 영상 {c.selectedVideoIds.length}개</p>
                    <p>원시 {c.sample.raw}건 · 적격 {c.sample.eligible}건</p>
                    <p>분류 완료 {c.sample.classified}건 · 미분류 {c.sample.unclassified}건</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="channel-compare__section"
              aria-labelledby="channel-comparison-sentiment">
              <h2 id="channel-comparison-sentiment">감성 분포 및 차이</h2>
              <p>분모는 각 채널 선정 영상의 분류 완료 댓글 수입니다.
                차이는 채널 B − A의 퍼센트포인트(%p)이며 상대 성장률이 아닙니다.</p>
              <div className="channel-compare__metrics">
                {ready.sentiment.map(metric => (
                  <div key={metric.label}>
                    <strong>{metric.label}</strong>
                    <p>채널 A {metric.aPercent.toFixed(2)}% · 채널 B {metric.bPercent.toFixed(2)}%</p>
                    <span className="channel-compare__delta">
                      B − A: {metric.deltaPp > 0 ? "+" : ""}{metric.deltaPp.toFixed(2)}%p
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section className="channel-compare__section"
              aria-labelledby="channel-comparison-topics">
              <h2 id="channel-comparison-topics">주제별 언급량 비교</h2>
              <p>주제는 다중 라벨이므로 합계는 고유 댓글 수가 아닙니다.
                주제 차이는 절대 언급 건수(B − A)입니다.</p>
              <ul className="channel-compare__topics" aria-label="채널별 주제 차이">
                {ready.topics.map(topic => {
                  const q = new URLSearchParams();
                  q.append("topic", topic.topicId);
                  q.append("channel", ready.left.channelId);
                  q.append("channel", ready.right.channelId);
                  return <li key={topic.topicId}>
                    <strong>{topic.topicId}</strong>
                    <span>채널 A {topic.aMentions}건 / 채널 B {topic.bMentions}건</span>
                    <span>B − A {topic.deltaCount > 0 ? "+" : ""}{topic.deltaCount}건</span>
                    <Link to={"/analysis/youtube/topics?" + q.toString()}>
                      {topic.topicId} 상세 탐색
                    </Link>
                  </li>;
                })}
              </ul>
            </section>
            <p className="channel-compare__notice">
              STATIC FIXTURE · 합성 DEMO · 채널 전체 여론, 인과관계,
              통계적 유의성 또는 실제 사용자의 성향을 뜻하지 않습니다.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
