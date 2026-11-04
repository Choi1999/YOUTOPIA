import { describe, expect, it } from "vitest";
import { withoutAllowedUtmTracking } from "./analysisQueryTracking";

const A = "UC" + "A".repeat(22);
const B = "UC" + "B".repeat(22);

function strip(value: string) {
  const result = withoutAllowedUtmTracking(new URLSearchParams(value));
  return result === null ? null : result.toString();
}

describe("YU-47/48 — bounded UTM attribution does not affect analysis selection", () => {
  it("preserves both channel slots while removing chatgpt.com attribution", () => {
    expect(strip("channel=" + A + "&channel=&utm_source=chatgpt.com"))
      .toBe("channel=" + A + "&channel=");
  });

  it("preserves topic and incomplete first channel in the reported URL", () => {
    expect(strip("topic=RECIPE&channel=&utm_source=chatgpt.com"))
      .toBe("topic=RECIPE&channel=");
  });

  it("keeps ordered and repeated application channel fields unchanged", () => {
    expect(strip("channel=" + B + "&channel=" + A + "&utm_source=chatgpt.com"))
      .toBe("channel=" + B + "&channel=" + A);
    expect(strip("channel=" + A + "&channel=" + A + "&utm_medium=email"))
      .toBe("channel=" + A + "&channel=" + A);
  });

  it("allows only the explicit bounded UTM attribution names", () => {
    expect(strip(
      "topic=PRICE&utm_source=chatgpt.com&utm_medium=link&utm_campaign=test" +
      "&utm_term=analysis&utm_content=card&utm_id=qa-2026",
    )).toBe("topic=PRICE");
  });

  it("treats UTM-only links as the ordinary no-application-query route", () => {
    expect(strip("utm_source=chatgpt.com")).toBe("");
    expect(strip("")).toBe("");
  });

  it("does not silently discard any non-UTM or unrelated tracking parameter", () => {
    expect(strip("channel=" + A + "&token=secret&utm_source=chatgpt.com"))
      .toBe("channel=" + A + "&token=secret");
    expect(strip("topic=RECIPE&gclid=something"))
      .toBe("topic=RECIPE&gclid=something");
  });

  it("fails closed for duplicate or unrecognized UTM fields", () => {
    expect(strip("topic=RECIPE&utm_source=one&utm_source=two")).toBeNull();
    expect(strip("topic=RECIPE&utm_source=one&utm_custom=anything")).toBeNull();
    expect(strip("topic=RECIPE&UTM_SOURCE=chatgpt.com")).toBe("topic=RECIPE&UTM_SOURCE=chatgpt.com");
  });

  it("fails closed for empty or oversized UTM values", () => {
    expect(strip("topic=RECIPE&utm_source=")).toBeNull();
    expect(strip("channel=" + A + "&utm_source=" + "x".repeat(129))).toBeNull();
    expect(strip("channel=" + A + "&utm_source=" + "x".repeat(128)))
      .toBe("channel=" + A);
  });

  it("rejects hidden controls in UTM values rather than normalizing them", () => {
    expect(strip("topic=RECIPE&utm_source=chatgpt.com%0Ainject")).toBeNull();
    expect(strip("topic=RECIPE&utm_source=%00")).toBeNull();
  });

  it("does not mutate a URLSearchParams instance belonging to the router", () => {
    const params = new URLSearchParams("channel=" + A + "&utm_source=chatgpt.com");
    const original = params.toString();
    const stripped = withoutAllowedUtmTracking(params);
    expect(stripped?.toString()).toBe("channel=" + A);
    expect(params.toString()).toBe(original);
  });
  it("accepts source metadata ahead of incomplete application fields without reordering them", () => {
    expect(strip("utm_source=chatgpt.com&channel=&channel="+A+"&utm_campaign=qa"))
      .toBe("channel=&channel="+A);
    expect(strip("utm_source=chatgpt.com&topic=&channel="+A))
      .toBe("topic=&channel="+A);
  });

});
