import { describe, expect, it } from "vitest";
import {
  parseComparisonQuery,
  buildComparisonSharePath,
  buildComparisonShareUrl,
} from "./comparisonShareLink";

const A = "Ab0_-123xyz", B = "Qb0_-123xyz";

describe("YU-39 — ID-only, canonical two-video share links", () => {
  it("default no-query entry is explicitly distinct from shared selection", () => {
    expect(parseComparisonQuery(new URLSearchParams())).toEqual({
      kind: "DEFAULT", videoIds: [],
    });
  });
  it("keeps a single Side Panel handoff as a single target", () => {
    expect(parseComparisonQuery(new URLSearchParams("video=" + A))).toEqual({
      kind: "SINGLE", videoIds: [A],
    });
  });
  it("preserves two-video A/B order from canonical share URL", () => {
    const path = buildComparisonSharePath([B, A]);
    expect(path).toBe("/analysis/youtube/compare?video=" + B + "&video=" + A);
    expect(parseComparisonQuery(new URLSearchParams(path?.split("?")[1]))).toEqual({
      kind: "PAIR", videoIds: [B, A],
    });
  });
  it.each([
    "video=" + A + "&video=" + A,
    "video=" + A + "&video=invalid",
    "video=" + A + "&video=" + B + "&video=Zb0_-123xyz",
    "video=" + A + "&token=secret",
    "other=" + A,
    "video=" + A + "&video=" + B + "&other=1",
    "video=",
  ])("rejects malformed or ambiguous share query: %s", query => {
    expect(parseComparisonQuery(new URLSearchParams(query))).toEqual({
      kind: "INVALID", videoIds: [],
    });
  });
  it("does not create links for missing/duplicate/invalid IDs", () => {
    for (const ids of [
      [], [A], [A, A], [A, "invalid"], [A, B, "Zb0_-123xyz"],
    ]) expect(buildComparisonSharePath(ids)).toBeNull();
  });
  it("produces an absolute localhost link with only two video IDs", () => {
    expect(buildComparisonShareUrl("http://localhost:5173", [A, B]))
      .toBe("http://localhost:5173/analysis/youtube/compare?video=" + A + "&video=" + B);
  });
  it("rejects invalid/untrusted origins without reflecting existing query/hash", () => {
    for (const origin of [
      "file:///", "javascript:alert(1)", "https://user:secret@example.com",
      "https://example.com/?token=secret", "https://example.com/#data",
      "https://example.com/other", "https://example.com.evil.example?x=1",
    ]) expect(buildComparisonShareUrl(origin, [A, B])).toBeNull();
  });
  it("works with a future same-origin HTTPS host without server access", () => {
    expect(buildComparisonShareUrl("https://analysis.example.test", [A, B]))
      .toBe("https://analysis.example.test/analysis/youtube/compare?video=" + A + "&video=" + B);
  });
});
