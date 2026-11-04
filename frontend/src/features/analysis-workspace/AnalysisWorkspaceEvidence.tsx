import { useEffect, useState } from "react";

import { createAnalysisTarget } from "../analysis-target/analysisTarget";
import { useAnalysisRepository } from "../analysis/data/AnalysisRepositoryContext";
import { readDemoChannelAggregate } from "../analysis/data/readDemoChannelAggregate";
import { projectDemoAnalysisSnapshot, type WebDetailProjection } from "../analysis/model/analysisProjection";
import type { ChannelAggregation } from "../analysis/model/channelAggregate";

type VideoEvidence =
  | Readonly<{ targetId: string; kind: "VERIFIED"; web: WebDetailProjection }>
  | Readonly<{ targetId: string; kind: "BLOCKED"; reason: string }>;

type ChannelEvidence = Readonly<{
  targetId: string;
  result: ChannelAggregation;
}>;

function formatCount(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("ko-KR") + "건" : "미확정";
}

export function VideoWorkspaceEvidence({ videoId }: { videoId: string }) {
  const repository = useAnalysisRepository();
  const [resolved, setResolved] = useState<VideoEvidence | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (!videoId) return;
    const target = createAnalysisTarget("VIDEO", videoId);
    if (!target) {
      setResolved({ targetId: videoId, kind: "BLOCKED", reason: "INVALID_TARGET" });
      return;
    }
    void repository.getSnapshot(target).then(read => {
      if (cancelled) return;
      if (read.kind !== "FOUND") {
        setResolved({ targetId: videoId, kind: "BLOCKED", reason: "NOT_FOUND" });
        return;
      }
      const projection = projectDemoAnalysisSnapshot(read.snapshot, target);
      setResolved(projection.kind === "PROJECTED"
        ? { targetId: videoId, kind: "VERIFIED", web: projection.web }
        : { targetId: videoId, kind: "BLOCKED", reason: projection.reason });
    }).catch(() => {
      if (!cancelled) {
        setResolved({ targetId: videoId, kind: "BLOCKED", reason: "READ_ERROR" });
      }
    });
    return () => { cancelled = true; };
  }, [repository, videoId]);

  const current = resolved?.targetId === videoId ? resolved : null;
  const web = current?.kind === "VERIFIED" ? current.web : null;
  const metricsAllowed = web &&
    (web.status === "READY" || web.status === "PARTIAL") &&
    web.sentimentPercent !== null && web.sample !== null;
  return (
    <section className="analysis-workspace__evidence" role="region"
      aria-label="영상 근거 상세">
      <h2>영상 A · 분석 근거 상세</h2>
      {!videoId ? (
        <p role="status">먼저 영상 A를 선택하세요.</p>
      ) : !current ? (
        <p role="status">선택한 영상의 합성 근거를 검증하고 있습니다.</p>
      ) : current.kind === "BLOCKED" ? (
        <p role="status">근거 검증 제한: {current.reason}.
          미등록·미검증 분석을 0건으로 표시하지 않습니다.</p>
      ) : (
        <>
          <p>대상: <code>{web!.target.targetId}</code> · 상태: {web!.status}</p>
          <p>출처: STATIC_FIXTURE · SNAPSHOT_DERIVED_SYNTHETIC
            · 실제 YouTube 수집 결과가 아닙니다.</p>
          <p>스냅샷: <code>{web!.snapshotId}</code></p>
          <p>관측 범위: {web!.observationScope.windowStart} ~
            {" "}{web!.observationScope.windowEnd} ({web!.observationScope.locale})</p>
          <p>분석 시각: {web!.analyzedAt ?? "미확정"} ·
            분석 버전: {web!.analysisVersion ?? "미확정"} ·
            주제 분류 버전: {web!.topicTaxonomyVersion ?? "미확정"}</p>
          {metricsAllowed ? (
            <>
              <dl className="analysis-workspace__counts" aria-label="영상 표본 처리 단계">
                <div><dt>원시 표본</dt><dd>{formatCount(web!.sample!.rawCount)}</dd></div>
                <div><dt>적격 표본</dt><dd>{formatCount(web!.sample!.eligibleCount)}</dd></div>
                <div><dt>제외 표본</dt><dd>{formatCount(web!.sample!.excludedCount)}</dd></div>
                <div><dt>분류 완료</dt><dd>{formatCount(web!.sample!.classifiedCount)}</dd></div>
                <div><dt>미분류</dt><dd>{formatCount(web!.sample!.unclassifiedCount)}</dd></div>
              </dl>
              <p>감성 비율 분모: 분류 완료 {web!.sentimentPercent!.denominator}건.
                원시·적격 표본을 감성 비율의 분모로 사용하지 않습니다.</p>
              {web!.status === "PARTIAL" && (
                <p>PARTIAL: 확인된 범위만 표시하며 미확정 표본은 추정하지 않습니다.</p>
              )}
            </>
          ) : (
            <p role="note">상태가 오래되었거나 제한되었거나 검증된 분모가 없어
              표본 수치와 감성 지표를 표시하지 않습니다.</p>
          )}
          <p>주제는 다중 라벨이며 언급 건수 합계는 고유 댓글 수가 아닙니다.</p>
        </>
      )}
    </section>
  );
}

export function ChannelWorkspaceEvidence({ channelId }: { channelId: string }) {
  const repository = useAnalysisRepository();
  const [resolved, setResolved] = useState<ChannelEvidence | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    if (!channelId) return;
    void readDemoChannelAggregate(repository, channelId).then(result => {
      if (!cancelled) setResolved({ targetId: channelId, result });
    }).catch(() => {
      if (!cancelled) setResolved({
        targetId: channelId,
        result: { kind: "BLOCKED", reason: "INCOMPLETE_OR_UNVERIFIED" },
      });
    });
    return () => { cancelled = true; };
  }, [repository, channelId]);

  const current = resolved?.targetId === channelId ? resolved.result : null;
  return (
    <section className="analysis-workspace__evidence" role="region"
      aria-label="채널 근거 상세">
      <h2>채널 A · 선정 영상 집합 근거</h2>
      {!channelId ? (
        <p role="status">먼저 채널 A를 선택하세요.</p>
      ) : !current ? (
        <p role="status">등록 합성 영상 집합의 집계 조건을 검증하고 있습니다.</p>
      ) : current.kind !== "READY" ? (
        <p role="status">근거 검증 제한: {current.reason}.
          미등록 또는 불완전한 선정 집합은 합산하지 않습니다.</p>
      ) : (
        <>
          <p>대상: <code>{current.channelId}</code> · 상태: READY</p>
          <p>STATIC_FIXTURE · 등록된 합성 영상 {current.selectedVideoIds.length}개 한정.
            실제 채널 소속·전체 댓글·구독자의 의견이 아닙니다.</p>
          <p>선정 영상 ID: {current.selectedVideoIds.join(", ")}</p>
          <p>관측 기간: {current.observationWindow.start} ~ {current.observationWindow.end}</p>
          <p>분류 버전: {current.taxonomyVersion} · 분석 버전: {current.analysisVersion}</p>
          <dl className="analysis-workspace__counts" aria-label="채널 선정 집합 표본 처리 단계">
            <div><dt>원시 표본</dt><dd>{formatCount(current.sample.raw)}</dd></div>
            <div><dt>적격 표본</dt><dd>{formatCount(current.sample.eligible)}</dd></div>
            <div><dt>제외 표본</dt><dd>{formatCount(current.sample.excluded)}</dd></div>
            <div><dt>분류 완료</dt><dd>{formatCount(current.sample.classified)}</dd></div>
            <div><dt>미분류</dt><dd>{formatCount(current.sample.unclassified)}</dd></div>
          </dl>
          <p>감성 분모는 분류 완료 {current.sample.classified}건입니다.
            주제는 다중 라벨이며 관측 표본 밖의 시청자를 추정하지 않습니다.</p>
        </>
      )}
    </section>
  );
}
