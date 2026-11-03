import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import { createAnalysisTarget } from "../../features/analysis-target/analysisTarget";
import { parseVideoBatch, type VideoBatchResult } from "../../features/analysis-target/videoInput";
import { parseComparisonQuery, buildComparisonSharePath, buildComparisonShareUrl } from "../../features/analysis-target/comparisonShareLink";
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
import { serializeSyntheticComparisonCsv, SYNTHETIC_COMPARISON_CSV_FILENAME } from "../../features/analysis/model/comparisonCsv";
import { demoChannelSelection } from "../../features/analysis/data/demoChannelSelection";

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
  const incoming = parseComparisonQuery(search);
  // Empty URL = ordinary demo; malformed URL = fail closed empty list.
  // One valid ID remains single; a valid pair retains its shared A/B order.
  return incoming.kind === "DEFAULT"
    ? [...EXAMPLES]
    : [...incoming.videoIds];
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
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const previousSearch = useRef(location.search);
  const [ids, setIds] = useState<string[]>(() => initialIds(query));
  const [selected, setSelected] = useState<string[]>(() =>
    initialIds(query).slice(0, 2),
  );
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState(() =>
    parseComparisonQuery(query).kind === "INVALID"
      ? "공유 링크의 영상 ID나 매개변수가 올바르지 않습니다. 영상을 직접 추가하세요."
      : "",
  );
  const [shareFeedback, setShareFeedback] = useState("");
  const [csvFeedback, setCsvFeedback] = useState("");
  const [filter, setFilter] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>({});

  /*
   * YU-40: React Router can update the query on this SAME mounted page.
   * Re-apply only when its actual search string changes. Do not reset on
   * local add/remove/filter/selection actions or on an unrelated re-render.
   */
  useEffect(() => {
    if (previousSearch.current === location.search) return;
    previousSearch.current = location.search;
    const current = new URLSearchParams(location.search);
    const nextIds = initialIds(current);
    setIds(nextIds);
    setSelected(nextIds.slice(0, 2));
    setEntries({});
    setInput("");
    setFilter("");
    setReadyOnly(false);
    setShareFeedback("");
    setCsvFeedback("");
    setFeedback(parseComparisonQuery(current).kind === "INVALID"
      ? "공유 링크의 영상 ID나 매개변수가 올바르지 않습니다. 영상을 직접 추가하세요."
      : "");
  }, [location.search]);

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

  /*
   * YU-38: 단일 영상 ID 또는 최대 8줄의 YouTube HTTPS URL 입력.
   * 각 줄을 순수 함수에서 검증하고 모든 항목이 적합할 때만 일괄 추가한다.
   * 실패/중복/목록 용량 초과에서는 어떤 목록 항목도 변경하지 않는다.
   */
  function addVideo(raw: string) {
    const parsed = parseVideoBatch(raw);
    if (parsed.kind === "INVALID") {
      const reasons: Record<Extract<VideoBatchResult, { kind: "INVALID" }>["reason"], string> = {
        EMPTY: "영상 ID 또는 URL을 입력하세요.",
        TOO_LONG: "입력 길이가 제한을 초과했습니다.",
        TOO_MANY: "한 번에 최대 8개 영상까지만 입력할 수 있습니다.",
        DUPLICATE: "같은 영상이 여러 줄에 중복되었습니다.",
        BAD_ID: "영상 ID가 정확한 11자가 아닙니다.",
        UNSUPPORTED_URL: "허용되지 않은 URL입니다. YouTube watch 또는 youtu.be의 HTTPS 주소만 지원합니다.",
        AMBIGUOUS_URL: "영상 ID가 없거나 중복된 주소입니다.",
      };
      setFeedback(
        "영상 ID는 영문·숫자·하이픈·밑줄로 구성된 11자여야 합니다. " +
        (parsed.line > 0 ? parsed.line + "번째 입력: " : "") +
        reasons[parsed.reason],
      );
      return;
    }

    if (parsed.videoIds.some(id => ids.includes(id))) {
      setFeedback("이미 목록에 추가한 영상입니다.");
      return;
    }
    if (ids.length + parsed.videoIds.length > MAX_TARGETS) {
      setFeedback("데모 목록은 최대 8개 영상까지 등록할 수 있습니다. 초과 입력은 추가하지 않았습니다.");
      return;
    }
    const additions = [...parsed.videoIds];
    setIds(previous => [...previous, ...additions]);
    setSelected(previous => [...previous, ...additions].slice(0, 2));
    setInput("");
    setFeedback(
      additions.length + "개 영상 ID를 목록에 추가했습니다. 등록되지 않은 영상은 데이터 미제공으로 표시됩니다.",
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addVideo(input);
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

  /*
   * YU-37: 선택 순서만 바꾸거나 명시적으로 비울 수 있다.
   * 목록·Repository·기존 스냅샷은 변경하지 않으며 추가 API 호출도 없다.
   */
  function swapSelected() {
    if (selected.length !== 2) return;
    setSelected(previous => [previous[1], previous[0]]);
    setFeedback("영상 A/B 비교 순서를 바꿨습니다. 차이는 새 B − A 기준으로 표시됩니다.");
  }

  function clearSelected() {
    setSelected([]);
    setFeedback("비교 대상을 해제했습니다. 목록은 그대로 유지됩니다.");
  }

  /* 필터는 임시 목록의 표시만 바꾸며 비교 선택은 유지한다. */
  const normalizedFilter = filter.trim().toLowerCase();
  const visibleIds = ids.filter(id => {
    const entry = entries[id];
    return (
      id.toLowerCase().includes(normalizedFilter) &&
      (!readyOnly ||
        (entry?.kind === "READY" &&
         entry.web.status === "READY" &&
         entry.web.sentimentPercent !== null))
    );
  });

  const selectedIssueId = selected.length === 2
    ? selected.find(id => entries[id] && entries[id].kind !== "READY")
    : undefined;
  const selectedIssue = selectedIssueId ? entries[selectedIssueId] : undefined;
  const selectedIssueDetail = selectedIssueId && selectedIssue
    ? selectedIssue.kind === "NOT_FOUND"
      ? "영상 " + selectedIssueId + "의 등록된 합성 스냅샷이 없습니다."
      : selectedIssue.kind === "REJECTED"
        ? "영상 " + selectedIssueId + "의 분석 스냅샷을 검증할 수 없습니다."
        : selectedIssue.kind === "ERROR"
          ? "영상 " + selectedIssueId + "의 데이터 조회에 오류가 발생했습니다."
          : ""
    : "";

  /* YU-39: use ONLY the current application's origin and two selected VIDEO IDs. */
  const returnPairQuery = buildComparisonSharePath(selected)?.split("?")[1] ?? null;

  const shareUrl = typeof window !== "undefined"
    ? buildComparisonShareUrl(window.location.origin, selected)
    : null;

  async function copyShareLink() {
    if (!shareUrl) return;
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      setShareFeedback("클립보드를 사용할 수 없습니다. 아래 링크를 직접 선택해 복사하세요.");
      return;
    }
    try {
      await clipboard.writeText(shareUrl);
      setShareFeedback("비교 구성 링크를 복사했습니다. 합성 분석 결과 자체를 저장한 링크는 아닙니다.");
    } catch {
      setShareFeedback("클립보드 복사에 실패했습니다. 아래 링크를 직접 선택해 복사하세요.");
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
  const csv = ready ? serializeSyntheticComparisonCsv(ready) : null;

  function downloadCsv() {
    if (!csv || typeof document === "undefined" ||
        typeof URL.createObjectURL !== "function" ||
        typeof URL.revokeObjectURL !== "function" ||
        typeof Blob === "undefined") {
      setCsvFeedback("이 환경에서는 CSV 저장을 지원하지 않습니다.");
      return;
    }

    let objectUrl: string | null = null;
    try {
      const file = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = SYNTHETIC_COMPARISON_CSV_FILENAME;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      try { anchor.click(); }
      finally { anchor.remove(); }
      setCsvFeedback("합성 데모 비교 CSV 저장을 시작했습니다. 실제 YouTube 분석 자료가 아닙니다.");
    } catch {
      setCsvFeedback("CSV 저장에 실패했습니다. 브라우저 다운로드 권한을 확인하세요.");
    } finally {
      if (objectUrl) {
        const pending = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(pending), 0);
      }
    }
  }



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
        <nav aria-label="분석 화면 탐색" className="video-compare__top-nav">
          <Link to="/analysis/youtube/video/Ab0_-123xyz">합성 영상 상세 예시</Link>
          <Link to="/analysis/youtube/compare">새 비교 화면</Link>
          <Link to={"/analysis/youtube/channel/" + demoChannelSelection.channelId}>
            선정 합성 채널 분석
          </Link>
        </nav>
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
            <p className="video-compare__input-hint">영상 ID 또는 YouTube watch/youtu.be 링크를 붙여넣으세요. 여러 영상은 한 줄에 하나씩 입력합니다.</p>
            <div className="video-compare__form-row">
              <textarea
                id="comparison-video-id"
                placeholder={"YouTube 영상 ID 또는 YouTube HTTPS URL\n여러 영상은 줄바꿈하여 입력"}
                autoComplete="off"
                rows={3}
                maxLength={16400}
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

          <div className="video-compare__selection-controls"
            role="group" aria-label="비교 대상 선택 관리">
            <div className="video-compare__selected-slots">
              <span>영상 A: <code>{selected[0] ?? "미선택"}</code></span>
              <span>영상 B: <code>{selected[1] ?? "미선택"}</code></span>
            </div>
            <div className="video-compare__selection-actions">
              <button type="button" onClick={swapSelected}
                disabled={selected.length !== 2}>
                A/B 순서 바꾸기
              </button>
              <button type="button" onClick={clearSelected}
                disabled={selected.length === 0}>
                비교 선택 해제
              </button>
              <a href="#comparison-results">비교 결과로 이동</a>
            </div>
          </div>
          <section className="video-compare__share"
            aria-labelledby="comparison-share-heading">
            <h3 id="comparison-share-heading">비교 구성 공유</h3>
            <p>영상 A/B ID와 순서만 포함하는 로컬 DEMO 링크입니다. 로그인·댓글·분석 원문은 담지 않습니다.</p>
            {shareUrl ? (
              <>
                <label htmlFor="comparison-share-url">비교 공유 링크</label>
                <input id="comparison-share-url" type="text" readOnly
                  value={shareUrl}
                  onFocus={event => event.currentTarget.select()} />
                <button type="button" onClick={() => { void copyShareLink(); }}>
                  링크 복사
                </button>
                <p>현재 localhost 실행 환경에서만 열 수 있습니다. 외부 공유용 서비스는 아직 제공하지 않습니다.</p>
              </>
            ) : (
              <p>공유 링크를 만들려면 서로 다른 영상 두 개를 선택하세요.</p>
            )}
            {shareFeedback && (
              <p role="status" className="video-compare__share-feedback">{shareFeedback}</p>
            )}
          </section>
          <div className="video-compare__filter">
            <label htmlFor="comparison-filter">영상 ID 필터</label>
            <input id="comparison-filter" type="search" value={filter}
              placeholder="목록에서 영상 ID 찾기"
              onChange={event => setFilter(event.target.value)}
            />
            <label className="video-compare__filter-option">
              <input type="checkbox" checked={readyOnly}
                onChange={event => setReadyOnly(event.target.checked)}
              />
              READY 스냅샷만 표시
            </label>
            <p>
              목록 {visibleIds.length} / {ids.length}개 표시
              · 필터는 비교 선택을 변경하지 않습니다.
            </p>
          </div>
          <ul className="video-compare__target-list" aria-label="분석 대상 영상 목록">
            {visibleIds.map(id => {
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
                    <Link to={
                      "/analysis/youtube/video/" + id +
                      (returnPairQuery && selected.includes(id) ? "?" + returnPairQuery : "")
                    }>상세 보기</Link>
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
          {ids.length > 0 && visibleIds.length === 0 && (
            <p role="status" className="video-compare__empty">
              현재 필터에 맞는 영상이 없습니다. 필터를 해제하거나 다른 영상 ID를 입력하세요.
            </p>
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

        <section id="comparison-results" className="video-compare__panel video-compare__results"
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
              {selectedIssueDetail && (
                <p className="video-compare__issue-detail">{selectedIssueDetail}</p>
              )}
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

              {csv && (
                <section className="video-compare__section video-compare__export"
                  aria-labelledby="comparison-export-heading">
                  <h3 id="comparison-export-heading">비교 결과 내보내기</h3>
                  <p>
                    검증된 합성 스냅샷의 감성·주제 집계만 CSV로 저장합니다.
                    실제 YouTube 댓글 원문이나 개인 정보는 포함되지 않습니다.
                  </p>
                  <button type="button" className="video-compare__export-button"
                    onClick={downloadCsv}>
                    합성 비교 CSV 다운로드
                  </button>
                  {csvFeedback && (
                    <p role="status" className="video-compare__export-status">{csvFeedback}</p>
                  )}
                  <p>STATIC FIXTURE · DEMO ONLY · 실제 데이터가 아닌 테스트용 CSV</p>
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
