import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { createAnalysisTarget } from "../../features/analysis-target/analysisTarget";
import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import {
  getDemoChannelSelection,
  type DemoChannelSelection,
} from "../../features/analysis/data/demoChannelSelection";
import {
  projectDemoAnalysisSnapshot,
  type WebDetailProjection,
} from "../../features/analysis/model/analysisProjection";

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

    void Promise.all(selection.videoIds.map(async videoId: string): Promise<ChannelVideoEntry> => {
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
              <Link to={"/analysis/youtube/video/" + entry.videoId}>
                영상 상세 분석
              </Link>
            </li>
          ))}
        </ol>
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
