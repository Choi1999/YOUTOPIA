import { describe, expect, it } from "vitest";
import {
  filterEvidence, formatEvidenceTime, importG2gEvidence, parseLocalSrt,
  supportedLocalMovie, type EvidenceMarker,
} from "./videoEvidenceModel";

function fixture() {
  return {
    kind: "G2G_LOCAL_OPERATOR_ADJUDICATION_V01", schemaVersion: 1, film: "Sintel",
    durationMs: 888032, sourceVideoSha256: "a".repeat(64),
    independentBlindGoldApproved: 0, g3Authorized: false, externalProviderCalls: 0, actualSpendUsd: 0,
    questions: Array.from({ length: 6 }, (_, i) => ({
      questionId: "G2E-SIN-0" + (i + 1),
      questionText: "합성 영상에 나타난 사실 또는 부재 정보는 무엇인가?",
      kind: i === 5 ? "UNSUPPORTED" : "VISUAL",
      result: i === 0 ? {
        status: "APPROVE", finalVerdict: "SUPPORTED", operatorViewedSource: true,
        finalAnswerText: "영상 속 인물이 이동하는 장면이 나타난다.",
        finalEvidence: [{
          modality: "FRAME", localStartMs: 88011, localEndMs: 90418,
          observationNote: "합성 단위 시험에 사용하는 화면상의 구체적인 이동 장면",
        }],
      } : i === 5 ? { status: "HOLD" } : { status: "PENDING" },
    })),
  };
}

describe("YU-49 G2-G read-only evidence import", () => {
  it("imports operator-approved evidence without implying independent Gold", () => {
    const result = importG2gEvidence(JSON.stringify(fixture()));
    expect(result.kind).toBe("READY");
    if (result.kind !== "READY") return;
    expect(result.operatorApproved).toBe(1);
    expect(result.held).toBe(1);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0].origin).toBe("OPERATOR_NON_BLIND");
    expect(result.markers[0].startMs).toBe(88011);
  });
  it("rejects malformed status, out-of-film evidence and G3/Gold claims", () => {
    const changes: Array<(x: ReturnType<typeof fixture>) => void> = [
      x => { x.g3Authorized = true; },
      x => { x.independentBlindGoldApproved = 1; },
      x => { x.sourceVideoSha256 = "bad"; },
      x => { x.questions[0].questionId = "G2E-TOS-01"; },
      x => { x.questions[1].questionId = "G2E-SIN-01"; },
    ];
    for (const change of changes) {
      const input = fixture(); change(input);
      expect(importG2gEvidence(JSON.stringify(input)).kind).toBe("INVALID");
    }
    const p = fixture();
    p.questions[0].result = {
      status: "APPROVE", finalVerdict: "SUPPORTED", operatorViewedSource: true,
      finalAnswerText: "영상 속 인물이 이동하는 장면이 나타난다.",
      finalEvidence: [{ modality: "FRAME", localStartMs: 88011, localEndMs: 999999,
        observationNote: "잘못된 동영상 길이에 대한 합성 시험 근거 구간" }],
    };
    expect(importG2gEvidence(JSON.stringify(p)).kind).toBe("INVALID");
  });
  it("does not generate timestamp markers for UNSUPPORTED claims", () => {
    const p = fixture();
    p.questions[5].result = {
      status: "APPROVE", finalVerdict: "UNSUPPORTED", operatorViewedSource: true,
      fullMovieReviewed: true,
      absenceRationale: "원본 전체에서 별도의 시간 정보를 찾지 못했다는 합성 기록",
      finalAnswerText: "시점을 확정할 수 없다.", finalEvidence: [],
    };
    const result = importG2gEvidence(JSON.stringify(p));
    expect(result.kind).toBe("READY");
    if (result.kind !== "READY") return;
    expect(result.operatorApproved).toBe(2);
    expect(result.markers).toHaveLength(1);
  });
  it("rejects invalid or wrong-source data and oversized JSON", () => {
    expect(importG2gEvidence("{bad").kind).toBe("INVALID");
    expect(importG2gEvidence(JSON.stringify({ ...fixture(), kind: "G2F_LOCAL_BLIND_REVIEW_PACKET" })).kind).toBe("INVALID");
    expect(importG2gEvidence(JSON.stringify({ ...fixture(), questions: [] })).kind).toBe("INVALID");
    expect(importG2gEvidence("x".repeat(2 * 1024 * 1024 + 1)).kind).toBe("INVALID");
  });
});

describe("YU-49 local SRT and search", () => {
  it("parses multiline SRT without interpreting HTML markup", () => {
    const result = parseLocalSrt("1\n00:00:01,250 --> 00:00:03,750\n첫 줄\n둘째 줄\n\n2\n00:00:04.000 --> 00:00:05.100\n<script>text</script>");
    expect(result).toEqual([
      { startMs: 1250, endMs: 3750, text: "첫 줄\n둘째 줄" },
      { startMs: 4000, endMs: 5100, text: "<script>text</script>" },
    ]);
  });
  it("ignores invalid timestamps and excessive source text", () => {
    expect(parseLocalSrt("nonsense")).toEqual([]);
    expect(parseLocalSrt("1\n00:00:10,000 --> 00:00:09,000\nInvalid")).toEqual([]);
    expect(parseLocalSrt("x".repeat(2 * 1024 * 1024 + 1))).toEqual([]);
  });
  it("filters only matched markers in chronological order", () => {
    const markers: EvidenceMarker[] = [
      { id: "a", questionId: "QA", label: "장면", observation: "설원 이동", modality: "FRAME", startMs: 6000, endMs: 9000, origin: "LOCAL_NOTE" },
      { id: "b", questionId: "QB", label: "대사", observation: "검의 과거", modality: "AUDIO", startMs: 2000, endMs: 4000, origin: "OPERATOR_NON_BLIND" },
      { id: "c", questionId: "QC", label: "장면", observation: "파이프를 뗀다", modality: "FRAME", startMs: 3000, endMs: 4500, origin: "OPERATOR_NON_BLIND" },
    ];
    expect(filterEvidence(markers, "", "ALL").map(x => x.id)).toEqual(["b", "c", "a"]);
    expect(filterEvidence(markers, "", "FRAME").map(x => x.id)).toEqual(["c", "a"]);
    expect(filterEvidence(markers, "설원", "ALL").map(x => x.id)).toEqual(["a"]);
    expect(filterEvidence(markers, "검", "FRAME")).toEqual([]);
  });
  it("supports local video types and precise millisecond time", () => {
    expect(supportedLocalMovie({ name: "file.MP4", size: 100 })).toBe(true);
    expect(supportedLocalMovie({ name: "file.mkv", size: 100 })).toBe(true);
    expect(supportedLocalMovie({ name: "report.json", size: 100 })).toBe(false);
    expect(supportedLocalMovie({ name: "file.mp4", size: 0 })).toBe(false);
    expect(formatEvidenceTime(88011)).toBe("01:28.011");
    expect(formatEvidenceTime(3600123)).toBe("01:00:00.123");
  });
});
