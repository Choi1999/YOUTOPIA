import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { createAnalysisTarget } from "../../features/analysis-target/analysisTarget";
import { useAnalysisRepository } from "../../features/analysis/data/AnalysisRepositoryContext";
import {
  projectDemoAnalysisSnapshot,
  type WebDetailProjection,
} from "../../features/analysis/model/analysisProjection";
import {
  compareVideoProjections,
  type VideoComparisonResult,
} from "../../features/analysis/model/videoComparison";

import { deriveComparisonHighlights } from "../../features/analysis/model/comparisonHighlights";

import "./video-comparison.css";

const EXAMPLES = ["Ab0_-123xyz", "Qb0_-123xyz"] as const;
const MAX_TARGETS = 8;

type Entry =
  | Readonly<{ kind: "READY"; web: WebDetailProjection }>
  | Readonly<{ kind: "NOT_FOUND" | "ERROR" | "REJECTED" }>;

const BLOCK_REASONS: Record<
  Extract<VideoComparisonResult, { kind: "BLOCKED" }>["reason"],
  string
> = {
  SAME_TARGET: "서로 다른 영상 두 개를 선택해야 합니다.",
  UNTRUSTED_SOURCE: "검증되지 않은 데이터 출처는 비교할 수 없습니다.",
  INSUFFICIENT_DATA:
    "두 영상 모두 검증된 READY 상태여야 합니다. PARTIAL·STALE·NO_DATA·정책 차단 상태에서는 비교 수치를 숨깁니다.",
  OBSERVATION_MISMATCH:
    "관측 기간 또는 언어·범위가 달라 직접 비교할 수 없습니다.",
  ANALYSIS_TIME_MISMATCH:
    "분석·관측 시점이 일치하지 않아 직접 비교할 수 없습니다.",
  VERSION_MISMATCH:
    "분석 또는 주제 분류 버전이 달라 직접 비교할 수 없습니다.",
  SAMPLE_MISMATCH:
    "적격 표본 수 또는 감성 분류 완료 수가 달라 이 데모에서는 직접 비교를 제한합니다.",
};

const ENTRY_LABEL: Record<Entry["kind"], string> = {
  READY: "합성 스냅샷 검증됨",
  NOT_FOUND: "분석 데이터 미제공",
  ERROR: "데이터 조회 오류",
  REJECTED: "스냅샷 검증 실패",
};

function initialIds(search: URLSearchParams): string[] {
  const matches = search.getAll("video");
  if (
    matches.length === 1 &&
    createAnalysisTarget("VIDEO", matches[0])
  ) {
    // Side Panel/상세 화면에서 전달된 ID 하나만 초기 선택한다.
    // 다른 영상을 동의 없이 추가하거나 실제 분석을 시작하지 않는다.
    return [matches[0]];
  }
  return [...EXAMPLES];
}

const sentiments = [
  { key: "positivePercent", label: "긍정", color: "positive" },
  { key: "neutralPercent", label: "중립", color: "neutral" },
  { key: "negativePercent", label: "부정", color: "negative" },
] as const;

/**
 * YU-35: 다중 영상 선택 목록과 두 영상의 검증된 합성 비교 화면.
 * 목록은 현재 컴포넌트 메모리에서만 유지된다. 지속 저장이나 서버 전송 없음.
 */
export function VideoComparisonPage() {
  const repository = useAnalysisRepository();
  const [searchParams] = useSearchParams();
  const [ids, setIds] = useState<string[]>(() => initialIds(searchParams));
  const [selected, setSelected] = useState<string[]>(() =>
    initialIds(searchParams).slice(0, 2),
  );
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  /*
   * 대상 목록이 변하면 이전 비동기 응답과 시각화 결과를 즉시 초기화한다.
   * 비교 계산은 projectDemoAnalysisSnapshot 검증을 통과한 데이터에서만 한다.
   * 두 영상 중 하나라도 NOT_FOUND/오류/미검증이면 결과를 숨긴다.
   */
  useEffect(() => {
    let cancelled = false;
    setEntries({});

    void Promise.all(ids.map(async (id): Promise<readonly [string, Entry]> => {
      const target = createAnalysisTarget("VIDEO", id);
      if (!target) return [id, { kind: "REJECTED" }];

      try {
        const result = await repository.getSnapshot(target);
        if (result.kind === "NOT_FOUND") {
          return [id, { kind: "NOT_FOUND" }];
        }
        const projection = projectDemoAnalysisSnapshot(
          result.snapshot, target,
        );
        if (projection.kind !== "PROJECTED") {
          return [id, { kind: "REJECTED" }];
        }
        return [id, { kind: "READY", web: projection.web }];
      } catch {
        return [id, { kind: "ERROR" }];
      }
    })).then(rows => {
      if (!cancelled) setEntries(Object.fromEntries(rows));
    });

    return () => { cancelled = true; };
  }, [ids, repository]);

  function addVideo(id: string) {
    const target = createAnalysisTarget("VIDEO", id);
    if (!target) {
      setFeedback("YouTube 영상 ID는 영문·숫자·하이픈·밑줄로 구성된 11자여야 합니다.");
      return;
    }
    if (ids.includes(target.targetId)) {
      setFeedback("이미 목록에 추가한 영상입니다.");
      return;
    }
    if (ids.length >= MAX_TARGETS) {
      setFeedback("데모 목록은 최대 8개 영상까지 등록할 수 있습니다.");
      return;
    }
    setIds(previous => [...previous, target.targetId]);
    setSelected(previous =>
      previous.length < 2 ? [...previous, target.targetId] : previous,
    );
    setInput("");
    setFeedback("영상 ID를 목록에 추가했습니다. 등록되지 않은 영상은 데이터 미제공으로 표시됩니다.");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addVideo(input.trim());
  }

  function removeVideo(id: string) {
    setIds(previous => previous.filter(value => value !== id));
    setSelected(previous => previous.filter(value => value !== id));
    setFeedback("선택한 영상을 이 화면의 임시 목록에서 제거했습니다.");
  }

  function toggleVideo(id: string, checked: boolean) {
    if (checked) {
      setSelected(previous =>
        previous.includes(id) || previous.length >= 2
          ? previous
          : [...previous, id],
      );
    } else {
      setSelected(previous => previous.filter(value => value !== id));
    }
  }

  const leftEntry = selected.length === 2 ? entries[selected[0]] : undefined;
  const rightEntry = selected.length === 2 ? entries[selected[1]] : undefined;

  const comparison =
    leftEntry?.kind === "READY" && rightEntry?.kind === "READY"
      ? compareVideoProjections(leftEntry.web, rightEntry.web)
      : null;

  const ready = comparison?.kind === "READY" ? comparison : null;
  const highlights = ready ? deriveComparisonHighlights(ready) : null;

  const waitingForResults =
    selected.length === 2 && (!leftEntry || !rightEntry);

  const incompleteMessage =
    selected.length !== 2
      ? "비교할 영상 두 개를 선택하세요."
      : waitingForResults
        ? "선택한 영상의 합성 스냅샷을 확인하고 있습니다."
        : "선택 영상 중 분석 데이터가 미제공되었거나 검증되지 않아 비교할 수 없습니다.";

  const maxTopicCount = ready
    ? ready.topics.reduce(
        (max, topic) => Math.max(max, topic.leftCount, topic.rightCount),
        1,
      )
    : 1;

  return (
    <div className="product-screen video-compare">
      <header className="product-heading video-compare__header">
        <div className="video-compare__eyebrow">YOUTOPIA · STATIC FIXTURE · DEMO</div>
        <h1>영상 비교 분석</h1>
        <p>
          영상 목록을 관리하고 검증된 합성 스냅샷 2개의 감성·주제를 비교합니다.
          실제 YouTube 댓글을 수집하거나 분석하지 않습니다.
        </p>
      </header>

      <div className="video-compare__layout">
        <section className="video-compare__panel video-compare__selection"
          aria-labelledby="video-compare-selection">
          <div className="video-compare__panel-heading">
            <h2 id="video-compare-selection">분석 대상 관리</h2>
            <span>{ids.length} / {MAX_TARGETS}개</span>
          </div>
          <form className="video-compare__form" onSubmit={onSubmit}>
            <label htmlFor="comparison-video-id">영상 ID 추가</label>
            <div className="video-compare__form-row">
              <input
                id="comparison-video-id"
                type="text"
                placeholder="11자리 YouTube 영상 ID"
                autoComplete="off"
                maxLength={64}
                value={input}
                onChange={event => setInput(event.target.value)}
              />
              <button type="submit">추가</button>
            </div>
          </form>
          {feedback && (
            <p role="status" className="video-compare__feedback">{feedback}</p>
          )}

          <p className="video-compare__instructions">
            비교할 영상 2개만 체크하세요. 이 목록은 브라우저 화면을 닫으면 사라집니다.
          </p>
          <ul className="video-compare__target-list" aria-label="분석 대상 영상 목록">
            {ids.map(id => {
              const checked = selected.includes(id);
              const state = entries[id];
              return (
                <li key={id} className="video-compare__target">
                  <label>
                    <input
                      type="checkbox"
                      aria-label={"비교 선택 " + id}
                      checked={checked}
                      disabled={!checked && selected.length >= 2}
                      onChange={event => toggleVideo(id, event.target.checked)}
                    />
                    <code>{id}</code>
                  </label>
                  <span className="video-compare__target-state">
                    {state ? ENTRY_LABEL[state.kind] : "조회 중"}
                    {state?.kind === "READY" && " · " + state.web.status}
                  </span>
                  <div className="video-compare__target-actions">
                    <Link to={"/analysis/youtube/video/" + id}>상세 보기</Link>
                    <button type="button" onClick={() => removeVideo(id)}
                      aria-label={"목록에서 제거 " + id}>
                      제거
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {ids.length === 0 && (
            <p className="video-compare__empty">목록이 비어 있습니다. 영상 ID를 추가하세요.</p>
          )}
          <div className="video-compare__example">
            <p>합성 데모 예시 영상</p>
            {EXAMPLES.map(id => (
              <button type="button" key={id} onClick={() => addVideo(id)}
                disabled={ids.includes(id) || ids.length >= MAX_TARGETS}>
                {id} 추가
              </button>
            ))}
          </div>
        </section>

        <section className="video-compare__panel video-compare__results"
          aria-labelledby="video-compare-results">
          <div className="video-compare__panel-heading">
            <h2 id="video-compare-results">두 영상 비교</h2>
            <span>{selected.length} / 2 선택</span>
          </div>

          {!ready && (
            <div className="video-compare__blocked" role="status">
              <strong>비교 수치 미표시</strong>
              <p>
                {comparison?.kind === "BLOCKED"
                  ? BLOCK_REASONS[comparison.reason]
                  : incompleteMessage}
              </p>
              <p>관측 조건이 같지 않으면 감성 차이·주제 언급량을 계산하지 않습니다.</p>
            </div>
          )}

          {ready && (
            <>
              <div className="video-compare__pair" aria-label="비교 대상 영상">
                <div>
                  <span>영상 A</span>
                  <code>{ready.left.target.targetId}</code>
                </div>
                <div>
                  <span>영상 B</span>
                  <code>{ready.right.target.targetId}</code>
                </div>
              </div>
              <div className="video-compare__evidence">
                <p>관측 기간: {ready.left.observationScope.windowStart}
                  {" ~ "}{ready.left.observationScope.windowEnd}</p>
                <p>분석 시각: {ready.left.analyzedAt}</p>
                <p>분석 버전: {ready.left.analysisVersion}</p>
                <p>분류 완료 표본: 각 {ready.left.sentimentPercent?.denominator}건</p>
              </div>

              {highlights && (
                <section aria-labelledby="comparison-highlights-title"
                  className="video-compare__section video-compare__highlights">
                  <h3 id="comparison-highlights-title">차이 한눈에 보기</h3>
                  <p>영상 B − 영상 A 기준입니다. 감성은 퍼센트포인트(%p), 주제는 언급 건수 차이입니다.</p>
                  <div className="video-compare__highlight-summary" role="note">
                    <strong>가장 큰 감성 분포 차이</strong>
                    <p>
                      {highlights.largestSentiment.deltaPp === 0
                        ? "긍정·중립·부정 비율 차이가 없습니다."
                        : "영상 B의 " + highlights.largestSentiment.label + " 비율은 영상 A보다 " +
                          Math.abs(highlights.largestSentiment.deltaPp).toFixed(1) + "%p " +
                          (highlights.largestSentiment.deltaPp > 0 ? "높습니다." : "낮습니다.")}
                    </p>
                  </div>
                  <div className="video-compare__delta-grid" aria-label="감성별 퍼센트포인트 차이">
                    {highlights.sentiments.map(item => (
                      <div key={item.key} className="video-compare__delta-card">
                        <span>{item.label}</span>
                        <strong>
                          {item.deltaPp > 0 ? "+" : ""}
                          {item.deltaPp.toFixed(1)}%p
                        </strong>
                        <small>영상 B − A</small>
                      </div>
                    ))}
                  </div>
                  {highlights.topTopicDifferences.length > 0 && (
                    <div className="video-compare__top-differences">
                      <h4>언급량 차이가 큰 주제 (최대 3개)</h4>
                      <ol>
                        {highlights.topTopicDifferences.map(topic => (
                          <li key={topic.topicId}>
                            <strong>{topic.topicId}</strong>
                            <span>
                              B − A: {topic.deltaCount > 0 ? "+" : ""}
                              {topic.deltaCount}건
                            </span>
                            <small>
                              A {topic.leftCount}건 · B {topic.rightCount}건
                            </small>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <p className="video-compare__interpretation">
                    같은 조건의 합성 스냅샷에 나타난 기술적 차이입니다.
                    시간에 따른 변화, 실제 영상의 우열, 원인 또는 통계적 유의성을 뜻하지 않습니다.
                  </p>
                </section>
              )}

              <section aria-labelledby="comparison-sentiment-title"
                className="video-compare__section">
                <h3 id="comparison-sentiment-title">감성 분포 비교</h3>
                <p>합성 스냅샷의 분류 완료 댓글 수를 분모로 한 비율입니다.</p>
                {([ready.left, ready.right] as const).map((web, index) => {
                  const metrics = web.sentimentPercent;
                  if (!metrics) return null;
                  return (
                    <div className="video-compare__sentiment" key={web.target.targetId}>
                      <div className="video-compare__bar-heading">
                        <strong>영상 {index === 0 ? "A" : "B"}</strong>
                        <code>{web.target.targetId}</code>
                      </div>
                      <div className="video-compare__stacked" role="img"
                        aria-label={
                          "영상 " + (index === 0 ? "A" : "B") +
                          " 긍정 " + metrics.positivePercent.toFixed(1) +
                          "% 중립 " + metrics.neutralPercent.toFixed(1) +
                          "% 부정 " + metrics.negativePercent.toFixed(1) + "%"
                        }>
                        {sentiments.map(item => (
                          <span key={item.key}
                            className={"video-compare__segment video-compare__segment--" + item.color}
                            style={{ width: metrics[item.key] + "%" }} />
                        ))}
                      </div>
                      <p className="video-compare__legend">
                        {sentiments.map(item => (
                          <span key={item.key}>
                            {item.label} {metrics[item.key].toFixed(1)}%
                          </span>
                        ))}
                      </p>
                    </div>
                  );
                })}
              </section>

              <section aria-labelledby="comparison-topics-title"
                className="video-compare__section">
                <h3 id="comparison-topics-title">주제별 언급량 비교</h3>
                <p>
                  같은 주제 분류 버전의 절대 언급 건수입니다.
                  다중 라벨이므로 합계를 댓글 점유율로 해석하지 않습니다.
                </p>
                <ul className="video-compare__topics" aria-label="주제별 영상 비교">
                  {ready.topics.map(topic => (
                    <li key={topic.topicId}>
                      <strong>{topic.topicId}</strong>
                      <div className="video-compare__topic-line">
                        <span>영상 A {topic.leftCount}건</span>
                        <div role="img" aria-label={
                          topic.topicId + " 영상 A 언급 " + topic.leftCount + "건"
                        } className="video-compare__track">
                          <span className="video-compare__topic-a" style={{
                            width: topic.leftCount / maxTopicCount * 100 + "%",
                          }} />
                        </div>
                      </div>
                      <div className="video-compare__topic-line">
                        <span>영상 B {topic.rightCount}건</span>
                        <div role="img" aria-label={
                          topic.topicId + " 영상 B 언급 " + topic.rightCount + "건"
                        } className="video-compare__track">
                          <span className="video-compare__topic-b" style={{
                            width: topic.rightCount / maxTopicCount * 100 + "%",
                          }} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p>막대는 이 비교에 포함된 주제 중 최다 언급 건수를 기준으로 합니다.</p>
              </section>
            </>
          )}
          <p className="video-compare__notice">
            STATIC FIXTURE · 합성 DEMO · 실제 YouTube 반응이나 시계열 추이가 아닙니다.
          </p>
        </section>
      </div>
    </div>
  );
}
