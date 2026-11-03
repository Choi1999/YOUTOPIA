import { describe, expect, it } from "vitest";
import { parseVideoBatch, parseVideoInput } from "./videoInput";

const A = "Ab0_-123xyz";
const B = "Qb0_-123xyz";

describe("YU-38 — exact-host, non-network video URL parser", () => {
  it("accepts an existing raw 11-character VIDEO ID", () => {
    expect(parseVideoInput(A)).toEqual({ kind: "VALID", videoId: A, type: "ID" });
  });

  it.each([
    "https://youtube.com/watch?v=" + A,
    "https://www.youtube.com/watch?v=" + A + "&t=40",
    "https://m.youtube.com/watch?t=8&v=" + A,
  ])("accepts standard YouTube watch links: %s", url => {
    expect(parseVideoInput(url)).toEqual({ kind: "VALID", videoId: A, type: "WATCH" });
  });

  it.each([
    "https://youtu.be/" + B,
    "https://www.youtu.be/" + B + "?si=demo",
  ])("accepts short YouTube video share links: %s", url => {
    expect(parseVideoInput(url)).toEqual({ kind: "VALID", videoId: B, type: "SHORT_LINK" });
  });

  it.each([
    "https://youtube.com.evil.example/watch?v=" + A,
    "https://evil.example/watch?v=" + A,
    "https://www.youtube.com@evil.example/watch?v=" + A,
    "http://www.youtube.com/watch?v=" + A,
    "javascript:alert(1)",
    "//youtu.be/" + A,
    "https://www.youtube.com/shorts/" + A,
    "https://www.youtube.com/embed/" + A,
    "https://youtube.com/playlist?list=" + A,
    "https://www.youtube.com/watch?v=" + A + "#fragment",
    "https://www.youtube.com/watch?v=" + A + " anything",
  ])("rejects unsupported/untrusted URL: %s", url => {
    expect(parseVideoInput(url).kind).toBe("INVALID");
  });

  it("rejects ambiguous or malformed VIDEO ID query", () => {
    expect(parseVideoInput("https://youtube.com/watch?v=" + A + "&v=" + B))
      .toEqual({ kind: "INVALID", reason: "AMBIGUOUS_URL" });
    expect(parseVideoInput("https://youtube.com/watch"))
      .toEqual({ kind: "INVALID", reason: "AMBIGUOUS_URL" });
    expect(parseVideoInput("https://youtu.be/" + A + "?v=" + B))
      .toEqual({ kind: "INVALID", reason: "AMBIGUOUS_URL" });
    expect(parseVideoInput("https://youtu.be/invalid").kind).toBe("INVALID");
  });

  it("rejects nonstrings, empty, long, and hidden-control values", () => {
    expect(parseVideoInput(null).kind).toBe("INVALID");
    expect(parseVideoInput("   ").kind).toBe("INVALID");
    expect(parseVideoInput("x".repeat(2049))).toEqual({ kind: "INVALID", reason: "TOO_LONG" });
    expect(parseVideoInput("https://youtu.be/" + A + "\t")).toEqual({
      kind: "INVALID", reason: "UNSUPPORTED_URL",
    });
    expect(parseVideoInput("https://youtu.be/" + A + "\u0001").kind).toBe("INVALID");
  });

  it("normalizes multiple valid lines to the exact two VIDEO IDs in order", () => {
    expect(parseVideoBatch("\n" + A + "\nhttps://youtu.be/" + B + "?si=demo\n"))
      .toEqual({ kind: "VALID", videoIds: [A, B] });
  });

  it("rejects duplicate normalized IDs across URL and raw ID atomically", () => {
    expect(parseVideoBatch(A + "\nhttps://youtube.com/watch?v=" + A))
      .toEqual({ kind: "INVALID", reason: "DUPLICATE", line: 2 });
  });

  it("rejects one hostile line without returning any partial IDs", () => {
    expect(parseVideoBatch(A + "\nhttps://youtube.com.evil.invalid/watch?v=" + B))
      .toEqual({ kind: "INVALID", reason: "UNSUPPORTED_URL", line: 2 });
  });

  it("caps batch size at eight without truncation", () => {
    const ids = Array.from({ length: 9 }, (_, i) => "Ab0_-123xy" + i);
    expect(parseVideoBatch(ids.join("\n"))).toEqual({
      kind: "INVALID", reason: "TOO_MANY", line: 9,
    });
  });

  it("caps total input and rejects empty input", () => {
    expect(parseVideoBatch(" \n\n ")).toEqual({ kind: "INVALID", reason: "EMPTY", line: 0 });
    expect(parseVideoBatch("x".repeat(16401))).toEqual({
      kind: "INVALID", reason: "TOO_LONG", line: 0,
    });
  });
});
