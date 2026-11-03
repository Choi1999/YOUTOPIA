import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { createAnalysisTarget } from "../../features/analysis-target/analysisTarget";
import { buildComparisonSharePath } from "../../features/analysis-target/comparisonShareLink";
import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import {
  getDemoChannelSelection,
  type DemoChannelSelection,
} from "../../features/analysis/data/demoChannelSelection";
import {
  projectDemoAnalysisSnapshot,
  type WebDetailProjection,
} from "../../features/analysis/model/analysisProjection";

import { aggregateSyntheticChannelSelection } from "../../features/analysis/model/channelAggregate";

import "./channel-analysis.css";

export type ChannelVideoEntry = Readonly<{
  videoId: string;
  kind: "READY" | "PARTIAL" | "STALE" | "NO_DATA" | "COMMENTS_DISABLED" |
    "POLICY_BLOCKED" | "ENTITLEMENT_LIMITED" | "ERROR" |
    "NOT_FOUND" | "INVALID_SNAPSHOT";
  web: WebDetailProjection | null;
}>;

const STATUS_LABELS: Record<ChannelVideoEntry["kind"], string> = {
  READY: "검증된 합성 READY 스냅샷",
  PARTIAL: "부분 분석 — 채널 집계 제한",
  STALE: "오래된 분석 — 채널 집계 제한",
  NO_DATA: "분석 가능한 자료 없음",
  COMMENTS_DISABLED: "댓글 확인 제한",
  POLICY_BLOCKED: "정책 제한",
  ENTITLEMENT_LIMITED: "사용 범위 제한",
  ERROR: "조회 오류 — 합산 불가",
  NOT_FOUND: "등록된 합성 분석 결과 없음",
  INVALID_SNAPSHOT: "검증되지 않은 스냅샷 — 합산 불가",
};

export function ChannelSelectionResult({
  selection,
}: {
  selection: DemoChannelSelection;
}) {
  const repository = useAnalysisRepository();
  const [rows, setRows] = useState<readonly ChannelVideoEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);

    void Promise.all(selection.videoIds.map(async (videoId: string): Promise<ChannelVideoEntry> => {
      const target = createAnalysisTarget("VIDEO", videoId);
      if (!target) return { videoId, kind: "INVALID_SNAPSHOT", web: null };

      try {
        const result = await repository.getSnapshot(target);
        if (result.kind !== "FOUND") return { videoId, kind: "NOT_FOUND", web: null };

        const projected = projectDemoAnalysisSnapshot(result.snapshot, target);
        if (projected.kind !== "PROJECTED") {
          return { videoId, kind: "INVALID_SNAPSHOT", web: null };
        }
        return {
          videoId,
          kind: projected.web.status,
          web: projected.web,
        };
      } catch {
        return { videoId, kind: "ERROR", web: null };
      }
    })).then(result => {
      if (!cancelled) setRows(result);
    });

    return () => { cancelled = true; };
  }, [repository, selection]);

  const aggregate = rows
    ? aggregateSyntheticChannelSelection(
        selection,
        rows.flatMap(entry => entry.web ? [entry.web] : []),
      )
    : null;

  return (
    <section className="channel-analysis__panel"
      aria-labelledby="channel-selection-heading">
      <div className="channel-analysis__heading">
        <h2 id="channel-selection-heading">선정 영상 목록</h2>
        <span>{selection.videoIds.length}개 · 명시적 합성 예시</span>
      </div>
      <p>
        실제 채널의 모든 영상 목록이 아닙니다. 고정된 합성 영상 ID 두 개를
        채널별 분석 화면 구성 시험을 위해 명시적으로 묶었습니다.
      </p>

      {rows === null ? (
        <p role="status">선정 영상의 합성 스냅샷을 검증하고 있습니다.</p>
      ) : (
        <ol aria-label="채널의 선정 영상 목록" className="channel-analysis__videos">
          {rows.map(entry => (
            <li key={entry.videoId}>
              <div>
                <strong>영상 ID: {entry.videoId}</strong>
                <span>{STATUS_LABELS[entry.kind]}</span>
              </div>
              <Link to={"/analysis/youtube/video/" + entry.videoId + "?channel=" + selection.channelId}>
                영상 상세 분석
              </Link>
            </li>
          ))}
        </ol>
      )}

      {rows && (
        <section className="channel-analysis__aggregate"
          aria-labelledby="channel-aggregate-heading">
          <div className="channel-analysis__heading">
            <h3 id="channel-aggregate-heading">선정 영상 집합 분석</h3>
            <span>YU-45 · 검증된 합성 스냅샷 한정</span>
          </div>
          {aggregate?.kind !== "READY" ? (
            <p role="status" className="channel-analysis__blocked">
              선정 영상 중 분석 데이터 미제공, 미검증, 오래됨 또는 관측 조건 불일치가
              있어 합산 수치를 표시하지 않습니다.
              모든 선정 영상이 동일 조건의 READY 스냅샷이어야 합니다.
            </p>
          ) : (
            <>
              <nav className="channel-analysis__nav" aria-label="채널 선정 영상 탐색">
                <Link to={buildComparisonSharePath(aggregate.selectedVideoIds) ??
                  "/analysis/youtube/compare"}>
                  이 두 합성 영상 비교하기
                </Link>
              </nav>
              <p>
                분석 범위: 등록된 합성 영상 {aggregate.selectedVideoIds.length}개
                (실제 채널 전체가 아님)
              </p>
              <div className="channel-analysis__sample" aria-label="선정 영상 표본 수치">
                <p>원시 댓글: {aggregate.sample.raw.toLocaleString("ko-KR")}건</p>
                <p>적격 댓글: {aggregate.sample.eligible.toLocaleString("ko-KR")}건</p>
                <p>제외: {aggregate.sample.excluded.toLocaleString("ko-KR")}건</p>
                <p>분류 완료: {aggregate.sample.classified.toLocaleString("ko-KR")}건</p>
                <p>미분류: {aggregate.sample.unclassified.toLocaleString("ko-KR")}건</p>
              </div>
              <h4>선정 영상 집합의 감성 분포</h4>
              <p>
                감성 분모: 두 영상의 분류 완료 댓글 총
                {aggregate.sample.classified.toLocaleString("ko-KR")}건
              </p>
              <div className="channel-analysis__sentiment"
                role="img"
                aria-label={
                  "선정 영상 감성 분포: 긍정 " +
                  aggregate.sentiment.positivePercent.toFixed(2) + "%, 중립 " +
                  aggregate.sentiment.neutralPercent.toFixed(2) + "%, 부정 " +
                  aggregate.sentiment.negativePercent.toFixed(2) + "%"
                }>
                <span className="channel-analysis__positive"
                  style={{width: aggregate.sentiment.positivePercent + "%"}} />
                <span className="channel-analysis__neutral"
                  style={{width: aggregate.sentiment.neutralPercent + "%"}} />
                <span className="channel-analysis__negative"
                  style={{width: aggregate.sentiment.negativePercent + "%"}} />
              </div>
              <div className="channel-analysis__legend" aria-label="선정 영상 감성 수치">
                <span>긍정: {aggregate.sentiment.positivePercent.toFixed(2)}%
                  ({aggregate.sentiment.positive}건)</span>
                <span>중립: {aggregate.sentiment.neutralPercent.toFixed(2)}%
                  ({aggregate.sentiment.neutral}건)</span>
                <span>부정: {aggregate.sentiment.negativePercent.toFixed(2)}%
                  ({aggregate.sentiment.negative}건)</span>
              </div>

              <h4>주제별 언급량 · 선정 영상 기여도</h4>
              <p>
                주제는 다중 라벨입니다. 언급량의 합계는 고유 댓글 수나
                채널 전체 댓글 점유율이 아닙니다.
              </p>
              <ol className="channel-analysis__topics" aria-label="채널 선정 영상 주제 언급량">
                {aggregate.topics.map(topic => (
                  <li key={topic.topicId}>
                    <strong>{topic.topicId} · {topic.mentionCount}건</strong>
                    <Link to={"/analysis/youtube/topics?topic=" + encodeURIComponent(topic.topicId) + "&channel=" + selection.channelId}>
                      {topic.topicId} 주제 상세 탐색
                    </Link>
                    <ul aria-label={topic.topicId + " 영상별 기여도"}>
                      {topic.perVideo.map(part => (
                        <li key={part.videoId}>
                          <span>{part.videoId}</span>
                          <span>{part.mentionCount}건</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <h4>영상별 분류 완료 표본 기여도</h4>
              <ul className="channel-analysis__contribution" aria-label="영상별 분석 기여도">
                {aggregate.videos.map(video => (
                  <li key={video.videoId}>
                    <strong>{video.videoId}</strong>
                    <span>
                      분류 완료 {video.classifiedCount}건 ·
                      전체 분류 완료 표본의 {video.classifiedSharePercent.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
              <div className="channel-analysis__provenance">
                <p>관측 기간: {aggregate.observationWindow.start}
                  {" ~ "}{aggregate.observationWindow.end}</p>
                <p>분석 시각: {aggregate.analyzedAt}</p>
                <p>분석 버전: {aggregate.analysisVersion}</p>
                <p>주제 분류 버전: {aggregate.taxonomyVersion}</p>
              </div>
              <p className="channel-analysis__note">
                STATIC FIXTURE · 합성 DEMO · 실제 채널의 전체 영상이나
                모든 시청자의 의견을 대표하지 않습니다.
              </p>
            </>
          )}
        </section>
      )}

      <p className="channel-analysis__note">
        STATIC FIXTURE · 선정 영상은 실제 채널 소속으로 확인된 자료가 아닙니다.
        실시간 수집이나 외부 YouTube API 호출은 수행하지 않습니다.
      </p>
    </section>
  );
}

/** A channel is never inferred from a handle/URL or arbitrary valid ID. */
export function ChannelAnalysisPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const target = channelId ? createAnalysisTarget("CHANNEL", channelId) : null;
  const selection = target ? getDemoChannelSelection(target.targetId) : null;

  return (
    <div className="product-screen channel-analysis">
      <header className="product-heading">
        <div className="channel-analysis__eyebrow">YOUTOPIA · STATIC FIXTURE · DEMO</div>
        <h1>채널 상세 분석</h1>
        <p>선정 영상 범위에 한정된 합성 데모입니다. 실제 채널 전체 반응이 아닙니다.</p>
        <nav className="channel-analysis__nav" aria-label="채널 화면 탐색">
          <Link to="/analysis/youtube/compare">영상 비교 목록으로 이동</Link>
          <Link to="/analysis/youtube/channels/compare">합성 채널 A/B 비교</Link>
        </nav>
      </header>
      {!target ? (
        <section className="channel-analysis__panel">
          <h2>유효하지 않은 채널 ID입니다.</h2>
          <p role="alert">확인된 YouTube 채널 ID(UC 접두사 포함) 형식이 아닙니다.</p>
        </section>
      ) : !selection ? (
        <section className="channel-analysis__panel">
          <h2>채널 분석 데이터 미제공</h2>
          <p role="status">
            채널 ID {target.targetId}에 등록된 합성 영상 집합이 없습니다.
            임의의 채널 분석 결과를 생성하지 않습니다.
          </p>
        </section>
      ) : (
        <>
          <section className="channel-analysis__panel">
            <div className="channel-analysis__heading">
              <h2>채널 분석 대상</h2>
              <span>STATIC FIXTURE</span>
            </div>
            <p className="channel-analysis__title">{selection.label}</p>
            <p>채널 ID: <code>{selection.channelId}</code></p>
            <p>선정 규칙: 명시적 합성 영상 집합</p>
            <p>선정 영상 수: {selection.videoIds.length}개 (실제 소속 증명 아님)</p>
          </section>
          <ChannelSelectionResult key={selection.channelId} selection={selection} />
        </>
      )}
    </div>
  );
}
