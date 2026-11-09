import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  filterEvidence,
  formatEvidenceTime,
  importG2gEvidence,
  MAX_LOCAL_JSON_BYTES,
  MAX_LOCAL_SRT_BYTES,
  parseLocalSrt,
  supportedLocalMovie,
  type EvidenceMarker,
  type EvidenceModality,
  type ImportedAdjudication,
  type SubtitleCue,
} from "../../features/video-evidence/videoEvidenceModel";
import "./video-evidence-explorer.css";

const MODALITY_LABELS: Record<EvidenceModality, string> = {
  AUDIO: "대사",
  FRAME: "화면",
  TRANSCRIPT: "자막",
  OCR: "화면 텍스트",
};

function readLocalText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") reject(new Error("텍스트를 읽지 못했습니다."));
      else resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("로컬 파일 읽기에 실패했습니다."));
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Consumer-facing evidence browsing. No backend, inference or remote upload.
 * Files are opt-in local selections; reviewed records are explicitly non-blind.
 */
export function VideoEvidenceExplorerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoPickerRef = useRef<HTMLInputElement | null>(null);
  const latestFileRead = useRef(0);
  const noteId = useRef(0);

  const [movieFile, setMovieFile] = useState<File | null>(null);
  const [movieUrl, setMovieUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [movieError, setMovieError] = useState("");
  const [captions, setCaptions] = useState<readonly SubtitleCue[]>([]);
  const [captionName, setCaptionName] = useState("");
  const [operatorReport, setOperatorReport] = useState<ImportedAdjudication | null>(null);
  const [imported, setImported] = useState<readonly EvidenceMarker[]>([]);
  const [personal, setPersonal] = useState<readonly EvidenceMarker[]>([]);
  const [feedback, setFeedback] = useState("");
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<EvidenceModality | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteModality, setNoteModality] = useState<EvidenceModality>("FRAME");

  useEffect(() => {
    if (!movieFile) {
      setMovieUrl(null);
      return;
    }
    const url = URL.createObjectURL(movieFile);
    setMovieUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [movieFile]);

  const allMarkers = useMemo(
    () => [...imported, ...personal],
    [imported, personal],
  );
  const filtered = useMemo(
    () => filterEvidence(allMarkers, query, modality),
    [allMarkers, query, modality],
  );
  // Navigation always follows the visible, filtered evidence list.
  // If the selection is filtered out, resume relative to the playback time.
  const selectedIndex = filtered.findIndex((marker) => marker.id === selectedId);
  const nextMarker = selectedIndex >= 0
    ? (filtered[selectedIndex + 1] ?? null)
    : (filtered.find((marker) => marker.startMs >= currentMs) ?? null);
  const previousMarker = selectedIndex >= 0
    ? (filtered[selectedIndex - 1] ?? null)
    : ([...filtered].reverse().find((marker) => marker.startMs < currentMs) ?? null);
  const activeCaption = useMemo(
    () => captions.find((cue) => currentMs >= cue.startMs && currentMs <= cue.endMs),
    [captions, currentMs],
  );

  function chooseMovie(file: File | undefined) {
    if (!file) return;
    if (!supportedLocalMovie(file)) {
      setFeedback("지원되는 로컬 영상 파일(MP4, WebM, MOV, MKV, OGV)을 선택하세요.");
      return;
    }
    latestFileRead.current += 1;
    setMovieFile(file);
    setDurationMs(null);
    setCurrentMs(0);
    setMovieError("");
    setCaptions([]);
    setCaptionName("");
    setImported([]);
    setOperatorReport(null);
    setPersonal([]);
    setSelectedId(null);
    setFeedback("로컬 영상이 선택되었습니다. 브라우저가 해당 코덱을 지원해야 재생됩니다.");
  }

  function onMovieChange(event: ChangeEvent<HTMLInputElement>) {
    chooseMovie(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }
  function onFileDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    chooseMovie(event.dataTransfer.files?.[0]);
  }

  async function chooseSrt(file: File | undefined) {
    if (!file) return;
    const request = ++latestFileRead.current;
    if (!/\.srt$/i.test(file.name) || file.size > MAX_LOCAL_SRT_BYTES || file.size === 0) {
      setFeedback("2MB 이하의 SRT 자막 파일을 선택하세요.");
      return;
    }
    try {
      const cues = parseLocalSrt(await readLocalText(file));
      if (request !== latestFileRead.current) return;
      if (!cues.length) {
        setCaptions([]);
        setCaptionName("");
        setFeedback("유효한 SRT 타임코드를 읽지 못했습니다.");
        return;
      }
      setCaptions(cues);
      setCaptionName(file.name);
      setFeedback("SRT 자막 " + cues.length + "개 구간을 로컬로 불러왔습니다.");
    } catch {
      if (request === latestFileRead.current) setFeedback("SRT 파일을 읽지 못했습니다.");
    }
  }

  async function chooseOperatorRecord(file: File | undefined) {
    if (!file) return;
    const request = ++latestFileRead.current;
    if (!/\.json$/i.test(file.name) || file.size > MAX_LOCAL_JSON_BYTES || file.size === 0) {
      setFeedback("2MB 이하의 G2-G 판정 JSON 파일만 지원합니다.");
      return;
    }
    try {
      const result = importG2gEvidence(await readLocalText(file));
      if (request !== latestFileRead.current) return;
      if (result.kind === "INVALID") {
        setFeedback(result.reason);
        return;
      }
      setOperatorReport(result);
      setImported(result.markers);
      setSelectedId(null);
      setFeedback(
        "운영자 판정 기록 " + result.operatorApproved +
        "문항을 불러왔습니다. 선택한 영상과 원본 해시가 일치하는지는 확인되지 않았습니다.",
      );
    } catch {
      if (request === latestFileRead.current) setFeedback("판정 JSON을 읽지 못했습니다.");
    }
  }

  function jumpTo(marker: EvidenceMarker) {
    setSelectedId(marker.id);
    if (!videoRef.current || !movieUrl) {
      setFeedback("영상 파일을 선택하면 해당 시각으로 이동할 수 있습니다.");
      return;
    }
    if (durationMs !== null && marker.startMs > durationMs) {
      setFeedback("선택한 영상의 길이보다 근거 시각이 늦습니다. 원본 판본을 확인하세요.");
      return;
    }
    videoRef.current.currentTime = marker.startMs / 1000;
    setCurrentMs(marker.startMs);
  }

  function addNote() {
    const note = noteText.trim();
    if (!movieUrl || !movieFile) {
      setFeedback("먼저 로컬 영상 파일을 선택하세요.");
      return;
    }
    if (note.length < 3 || note.length > 500) {
      setFeedback("관찰 기록은 3~500자로 입력하세요.");
      return;
    }
    if (personal.length >= 60) {
      setFeedback("한 세션에서 사용자 메모는 최대 60개까지 작성할 수 있습니다.");
      return;
    }
    const startMs = Math.max(0, Math.round((videoRef.current?.currentTime ?? 0) * 1000));
    if (durationMs !== null && startMs >= durationMs) {
      setFeedback("영상 마지막 프레임에서는 새 근거를 만들 수 없습니다.");
      return;
    }
    const endMs = Math.min(durationMs ?? startMs + 2000, startMs + 2000);
    noteId.current++;
    const marker: EvidenceMarker = {
      id: "local:" + noteId.current,
      questionId: null,
      label: "직접 추가한 근거",
      observation: note,
      modality: noteModality,
      startMs,
      endMs,
      origin: "LOCAL_NOTE",
    };
    setPersonal((old) => [...old, marker]);
    setSelectedId(marker.id);
    setNoteText("");
    setFeedback("현재 영상 시점에 개인 근거를 추가했습니다. 서버에 저장되지 않습니다.");
  }

  function clearAll() {
    latestFileRead.current += 1;
    setMovieFile(null);
    setMovieUrl(null);
    setCaptions([]);
    setCaptionName("");
    setOperatorReport(null);
    setImported([]);
    setPersonal([]);
    setDurationMs(null);
    setCurrentMs(0);
    setSelectedId(null);
    setQuery("");
    setModality("ALL");
    setNoteText("");
    setMovieError("");
    setFeedback("선택한 파일과 메모를 이 화면에서 비웠습니다.");
    if (videoPickerRef.current) videoPickerRef.current.value = "";
  }

  const shownTimeline = durationMs && durationMs > 0
    ? filtered.filter((m) => m.startMs <= durationMs)
    : [];

  return (
    <div className="product-screen video-evidence-explorer">
      <header className="product-heading">
        <p className="video-evidence-explorer__eyebrow">YOUTOPIA · LOCAL VIDEO EVIDENCE</p>
        <h1>영상 근거 탐색</h1>
        <p>
          영상과 자막을 로컬로 열고, 근거 시각을 찾아보거나 직접 메모할 수 있습니다.
          AI 자동 분석·YouTube 다운로드는 실행하지 않습니다.
        </p>
      </header>

      <section className="video-evidence-explorer__drop" onDragOver={(e) => e.preventDefault()} onDrop={onFileDrop}>
        <div className="video-evidence-explorer__drop-intro">
          <strong>영상 선택 또는 드래그앤드롭</strong>
          <span>{movieFile ? movieFile.name : "사용 권한이 있는 로컬 파일만 선택하세요. 외부 전송 없음."}</span>
        </div>
        <label className="video-evidence-explorer__file-button">
          로컬 영상 열기
          <input aria-label="로컬 영상 파일" ref={videoPickerRef} type="file"
            accept=".mp4,.webm,.mov,.mkv,.ogv,video/*" onChange={onMovieChange}/>
        </label>
        <button className="video-evidence-explorer__clear" type="button" onClick={clearAll}>화면 비우기</button>
      </section>

      <section className="video-evidence-explorer__workspace" aria-label="영상 탐색 작업공간">
        <div className="video-evidence-explorer__viewer">
          <div className="video-evidence-explorer__panel-heading">
            <h2 title={movieFile?.name}>{movieFile ? movieFile.name.replace(/\.[^.]+$/, "") : "영상 플레이어"}</h2>
            <small>{movieFile ? "로컬 선택 영상" : "영상 없음"}</small>
          </div>
          {movieUrl ? (
            <video aria-label="선택한 로컬 영상" ref={videoRef} controls playsInline preload="metadata" src={movieUrl}
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration;
                setDurationMs(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null);
              }}
              onTimeUpdate={(e) => setCurrentMs(Math.round(e.currentTarget.currentTime * 1000))}
              onError={() => setMovieError("이 브라우저에서 영상 코덱을 재생할 수 없습니다. 브라우저가 지원하는 MP4/H.264 파일을 사용하세요.")}
            />
          ) : (
            <div className="video-evidence-explorer__empty-player" role="status">
              영상을 선택하면 재생 화면과 근거 타임라인이 나타납니다.
            </div>
          )}
          {movieError && <p role="alert" className="video-evidence-explorer__error">{movieError}</p>}
          <div className="video-evidence-explorer__caption">
            <span>{captionName ? "SRT · " + captionName : "자막 없음"}</span>
            <strong>{activeCaption?.text || "현재 시각의 자막이 없습니다."}</strong>
            <time>{formatEvidenceTime(currentMs)}{durationMs !== null ? " / " + formatEvidenceTime(durationMs) : ""}</time>
          </div>
          <div className="video-evidence-explorer__timeline" role="group" aria-label="근거 타임라인">
            <span>근거 시점</span>
            <div className="video-evidence-explorer__track">
              {shownTimeline.map((marker) => (
                <button key={marker.id} type="button"
                  className={selectedId === marker.id ? "active" : ""}
                  style={{ left: (marker.startMs / (durationMs || 1) * 100) + "%" }}
                  title={formatEvidenceTime(marker.startMs) + " · " + marker.observation}
                  aria-label={"근거 " + formatEvidenceTime(marker.startMs) + " 이동"}
                  onClick={() => jumpTo(marker)}
                />
              ))}
            </div>
          </div>
          <div className="video-evidence-explorer__sources">
            <label>로컬 SRT 자막
              <input aria-label="로컬 SRT 자막" type="file" accept=".srt"
                onChange={(e) => { void chooseSrt(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/>
            </label>
            <label>G2-G 운영자 판정 JSON
              <input aria-label="G2-G 운영자 판정 JSON" type="file" accept=".json"
                onChange={(e) => { void chooseOperatorRecord(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }}/>
            </label>
          </div>
          {operatorReport && (
            <details className="video-evidence-explorer__provenance">
              <summary>근거 출처 및 확인 범위</summary>
              <p>
                {operatorReport.film} · 운영자 채택 {operatorReport.operatorApproved}문항 · 보류 {operatorReport.held}문항.
                비블라인드 판정 기록이며 현재 선택한 영상과 파일 해시는 대조하지 않았습니다.
              </p>
            </details>
          )}
        </div>

        <aside className="video-evidence-explorer__evidence" aria-label="근거 목록">
          <div className="video-evidence-explorer__panel-heading">
            <h2>근거 목록</h2>
            <small>{filtered.length} / {allMarkers.length}개 표시</small>
          </div>
          <div className="video-evidence-explorer__navigation" role="group" aria-label="근거 순차 탐색">
            <button type="button" disabled={!previousMarker}
              onClick={() => { if (previousMarker) jumpTo(previousMarker); }}>이전 근거</button>
            <span aria-live="polite">{selectedIndex >= 0
              ? (selectedIndex + 1) + " / " + filtered.length
              : "조건 일치 " + filtered.length + "개"}</span>
            <button type="button" disabled={!nextMarker}
              onClick={() => { if (nextMarker) jumpTo(nextMarker); }}>다음 근거</button>
          </div>
          <div className="video-evidence-explorer__filters">
            <label>근거 검색
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                type="search" placeholder="질문·관찰 내용 검색"/>
            </label>
            <label>근거 유형
              <select value={modality}
                onChange={(e) => setModality(e.target.value as EvidenceModality | "ALL")}>
                <option value="ALL">전체</option>
                <option value="AUDIO">대사</option>
                <option value="FRAME">화면</option>
                <option value="TRANSCRIPT">자막</option>
                <option value="OCR">화면 텍스트</option>
              </select>
            </label>
          </div>
          <div className="video-evidence-explorer__list" aria-live="polite">
            {filtered.length === 0 ? (
              <p className="video-evidence-explorer__no-match">
                {allMarkers.length === 0
                  ? "아직 근거가 없습니다. 운영자 판정 JSON을 불러오거나 영상 시점에 메모를 추가하세요."
                  : "현재 검색·필터에 일치하는 근거가 없습니다."}
              </p>
            ) : (
              filtered.map((marker) => (
                <article className={selectedId === marker.id ? "selected" : ""}
                  key={marker.id}>
                  <button type="button" onClick={() => jumpTo(marker)}>
                    <span className="video-evidence-explorer__entry-meta">
                      <time>{formatEvidenceTime(marker.startMs)} – {formatEvidenceTime(marker.endMs)}</time>
                      <span>{MODALITY_LABELS[marker.modality]}</span>
                    </span>
                    <strong>{marker.observation}</strong>
                    <small>{marker.origin === "LOCAL_NOTE"
                      ? "내 메모"
                      : (marker.questionId ?? "") + " · 운영자 판정(비블라인드)"}</small>
                  </button>
                  {marker.origin === "LOCAL_NOTE" && (
                    <button type="button" className="video-evidence-explorer__remove"
                      aria-label={"메모 삭제 " + formatEvidenceTime(marker.startMs)}
                      onClick={() => setPersonal((old) => old.filter((x) => x.id !== marker.id))}>
                      삭제
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
          <div className="video-evidence-explorer__note">
            <h3>현재 시점에 메모 추가</h3>
            <label>관찰 기록
              <textarea value={noteText} maxLength={500}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="영상에서 보이거나 들리는 내용을 작성"/>
            </label>
            <div>
              <label>유형
                <select value={noteModality}
                  onChange={(e) => setNoteModality(e.target.value as EvidenceModality)}>
                  <option value="FRAME">화면</option>
                  <option value="AUDIO">대사</option>
                  <option value="TRANSCRIPT">자막</option>
                  <option value="OCR">화면 텍스트</option>
                </select>
              </label>
              <button disabled={!movieUrl || noteText.trim().length < 3} type="button"
                onClick={addNote}>시점 메모 추가</button>
            </div>
          </div>
        </aside>
      </section>
      {feedback && <p className="video-evidence-explorer__feedback" role="status">{feedback}</p>}
      <footer className="video-evidence-explorer__disclosure">
        모든 파일은 사용자의 브라우저 메모리에서만 처리합니다. 새로 작성한 메모는 새로고침 시 사라지며
        AI 추론, 영상 업로드, 실제 YouTube 데이터 수집, Gold 승인 또는 G3 호출을 수행하지 않습니다.
      </footer>
    </div>
  );
}
