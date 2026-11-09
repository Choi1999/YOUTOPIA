/**
 * Consumer-facing, LOCAL-ONLY video evidence explorer contract.
 *
 * Video / subtitles / G2-G files are supplied by the user and never sent to a
 * server. Operator adjudications are NON-BLIND, not verified model accuracy
 * and cannot be elevated into independent Gold.
 */
export type EvidenceModality = "AUDIO" | "FRAME" | "TRANSCRIPT" | "OCR";
export type EvidenceOrigin = "OPERATOR_NON_BLIND" | "LOCAL_NOTE";
export type EvidenceMarker = Readonly<{
  id: string;
  questionId: string | null;
  label: string;
  observation: string;
  modality: EvidenceModality;
  startMs: number;
  endMs: number;
  origin: EvidenceOrigin;
}>;
export type SubtitleCue = Readonly<{ startMs: number; endMs: number; text: string }>;

export type ImportedAdjudication = Readonly<{
  kind: "READY";
  film: "Sintel" | "TearsOfSteel";
  durationMs: number;
  sourceVideoSha256: string;
  markers: readonly EvidenceMarker[];
  operatorApproved: number;
  held: number;
}>;

export type ImportResult =
  | ImportedAdjudication
  | Readonly<{ kind: "INVALID"; reason: string }>;

const MODALITIES: readonly EvidenceModality[] = ["AUDIO", "FRAME", "TRANSCRIPT", "OCR"];
const LIMIT_MS = 24 * 60 * 60 * 1000;
export const MAX_LOCAL_JSON_BYTES = 2 * 1024 * 1024;
export const MAX_LOCAL_SRT_BYTES = 2 * 1024 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value: unknown, limit = 1600): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}
function validMs(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 0 && value <= LIMIT_MS;
}
function isModality(value: unknown): value is EvidenceModality {
  return typeof value === "string" && MODALITIES.some((m) => m === value);
}

/** Never trust filename/content to authorize YouTube or externally sourced media. */
export function supportedLocalMovie(file: Pick<File, "name" | "size">): boolean {
  return file.size > 0 && file.size <= 8 * 1024 * 1024 * 1024 &&
    /\.(mp4|webm|ogv|mov|mkv)$/i.test(file.name);
}

export function formatEvidenceTime(ms: number): string {
  const n = Math.max(0, Math.round(ms));
  const hours = Math.floor(n / 3600000);
  const minutes = Math.floor(n / 60000) % 60;
  const seconds = Math.floor(n / 1000) % 60;
  const fraction = String(n % 1000).padStart(3, "0");
  const prefix = hours > 0 ? String(hours).padStart(2, "0") + ":" : "";
  return prefix + String(minutes).padStart(2, "0") + ":" +
    String(seconds).padStart(2, "0") + "." + fraction;
}

function parseCueTime(value: string): number | null {
  const parsed = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!parsed) return null;
  const hours = Number(parsed[1] ?? "0");
  const minutes = Number(parsed[2]);
  const seconds = Number(parsed[3]);
  if (minutes >= 60 || seconds >= 60) return null;
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000 +
    Number(parsed[4].padEnd(3, "0"));
  return validMs(ms) ? ms : null;
}

/** Parse only user-selected SRT text. React escapes cue text; no HTML is rendered. */
export function parseLocalSrt(text: string): readonly SubtitleCue[] {
  if (typeof text !== "string" || text.length === 0 ||
    text.length > MAX_LOCAL_SRT_BYTES) return [];
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const result: SubtitleCue[] = [];
  for (const block of normalized.split(/\n\s*\n/)) {
    if (result.length >= 8000) return [];
    const lines = block.trim().split("\n");
    const idx = lines.findIndex((s) => s.includes("-->"));
    if (idx < 0 || idx > 1) continue;
    const pieces = /^\s*(\S+)\s*-->\s*(\S+)/.exec(lines[idx]);
    if (!pieces) continue;
    const startMs = parseCueTime(pieces[1]);
    const endMs = parseCueTime(pieces[2]);
    const cue = lines.slice(idx + 1).join("\n").trim();
    if (startMs === null || endMs === null || startMs >= endMs ||
      cue.length === 0 || cue.length > 1000) continue;
    result.push({ startMs, endMs, text: cue });
  }
  result.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return result;
}

function invalid(reason: string): ImportResult {
  return { kind: "INVALID", reason };
}

/**
 * Import ONLY final operator-adjudication evidence.
 * Existing operator APPROVE is a review record, NOT independently verified Gold.
 * This does not confirm that a separately selected video has the same SHA256.
 */
export function importG2gEvidence(json: string): ImportResult {
  if (!nonempty(json, MAX_LOCAL_JSON_BYTES)) return invalid("판정 파일이 비어 있거나 너무 큽니다.");
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    return invalid("JSON 파일 형식이 올바르지 않습니다.");
  }
  if (!isObject(root) || root.kind !== "G2G_LOCAL_OPERATOR_ADJUDICATION_V01" ||
    root.schemaVersion !== 1 || !["Sintel", "TearsOfSteel"].includes(String(root.film)) ||
    root.independentBlindGoldApproved !== 0 || root.g3Authorized !== false ||
    root.externalProviderCalls !== 0 || root.actualSpendUsd !== 0 ||
    !validMs(root.durationMs) || root.durationMs < 60_000 ||
    typeof root.sourceVideoSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(root.sourceVideoSha256) ||
    !Array.isArray(root.questions) || root.questions.length !== 6) {
    return invalid("G2-G 운영자 판정 파일 또는 승인 게이트가 올바르지 않습니다.");
  }
  const film = root.film as "Sintel" | "TearsOfSteel";
  const durationMs = root.durationMs as number;
  const seen = new Set<string>();
  const markers: EvidenceMarker[] = [];
  let operatorApproved = 0;
  let held = 0;
  for (const candidate of root.questions) {
    if (!isObject(candidate) || !isObject(candidate.result) ||
      !nonempty(candidate.questionId, 60) ||
      !new RegExp("^G2E-" + (film === "Sintel" ? "SIN" : "TOS") + "-0[1-6]$").test(candidate.questionId) ||
      seen.has(candidate.questionId) || !nonempty(candidate.questionText, 400) ||
      !["SPEECH", "VISUAL", "TEMPORAL", "UNSUPPORTED"].includes(String(candidate.kind))) {
      return invalid("판정 질문의 ID·형식·중복 여부가 올바르지 않습니다.");
    }
    seen.add(candidate.questionId);
    const review = candidate.result;
    if (!["APPROVE", "HOLD", "REVISE", "PENDING"].includes(String(review.status))) {
      return invalid("알 수 없는 운영자 판정이 포함되어 있습니다.");
    }
    if (review.status === "HOLD") held++;
    if (review.status !== "APPROVE") continue;
    operatorApproved++;
    if (review.operatorViewedSource !== true || !nonempty(review.finalAnswerText) ||
      !["SUPPORTED", "UNSUPPORTED"].includes(String(review.finalVerdict)) ||
      !Array.isArray(review.finalEvidence)) {
      return invalid("APPROVE에 필요한 사람 확인 또는 정답 정보가 없습니다.");
    }
    if (review.finalVerdict === "UNSUPPORTED") {
      if (review.fullMovieReviewed !== true || review.finalEvidence.length > 0 ||
        !nonempty(review.absenceRationale)) {
        return invalid("근거 부재 판정의 전체 원본 확인 조건이 충족되지 않았습니다.");
      }
      continue; // Never manufacture a seekable timestamp for an absence claim.
    }
    if (review.finalEvidence.length < 1 || review.finalEvidence.length > 10) {
      return invalid("승인 문항의 근거 구간 수가 잘못되었습니다.");
    }
    for (let i = 0; i < review.finalEvidence.length; i++) {
      const e: unknown = review.finalEvidence[i];
      if (!isObject(e) || !isModality(e.modality) ||
        !validMs(e.localStartMs) || !validMs(e.localEndMs) ||
        e.localEndMs <= e.localStartMs || e.localEndMs > durationMs ||
        !nonempty(e.observationNote, 600)) {
        return invalid("근거 구간의 시각·유형·관찰 내용이 올바르지 않습니다.");
      }
      markers.push({
        id: candidate.questionId + ":" + i,
        questionId: candidate.questionId,
        label: String(candidate.questionText),
        observation: String(e.observationNote),
        modality: e.modality,
        startMs: e.localStartMs,
        endMs: e.localEndMs,
        origin: "OPERATOR_NON_BLIND",
      });
    }
  }
  if (markers.length > 60 || seen.size !== 6) {
    return invalid("필요한 6개 문항이 완전하지 않습니다.");
  }
  markers.sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
  return { kind: "READY", film, durationMs, sourceVideoSha256: root.sourceVideoSha256,
    markers, operatorApproved, held };
}

export function filterEvidence(
  markers: readonly EvidenceMarker[],
  query: string,
  modality: EvidenceModality | "ALL",
): readonly EvidenceMarker[] {
  const needle = query.trim().toLocaleLowerCase();
  return markers.filter((m) =>
    (modality === "ALL" || m.modality === modality) &&
    (needle === "" || [m.questionId ?? "", m.label, m.observation]
      .some((text) => text.toLocaleLowerCase().includes(needle))),
  ).sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}
