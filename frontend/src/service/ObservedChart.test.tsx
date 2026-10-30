import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ObservedChart, StatePanel, number } from "./components";
import { ApiError } from "./api";
it("moves only between real observation points and preserves zero", () => {
  render(
    <ObservedChart
      title="실제 CCU"
      points={[
        { at: "2026-10-01T00:00:00Z", value: 0 },
        { at: "2026-10-02T00:00:00Z", value: 123 },
      ]}
    />,
  );
  const chart = screen.getByRole("group", { name: "실제 CCU 관측점 탐색" });
  expect(screen.getByRole("status")).toHaveTextContent("0명");
  fireEvent.keyDown(chart, { key: "ArrowRight" });
  expect(screen.getByRole("status")).toHaveTextContent("123명");
  fireEvent.keyDown(chart, { key: "ArrowRight" });
  expect(screen.getByRole("status")).toHaveTextContent("123명");
});
it("does not expose point interactions for empty data", () => {
  render(<ObservedChart title="빈 CCU" points={[]} />);
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(screen.getByText(/실제 관측점이 없습니다/)).toBeVisible();
});
it("keeps source errors separate from an empty result", () => {
  render(<StatePanel error={new ApiError(503, "SOURCE_UNAVAILABLE")} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "데이터를 불러오지 못했습니다",
  );
  expect(
    screen.queryByText("표시할 관측 데이터가 없습니다."),
  ).not.toBeInTheDocument();
});

it("preserves the eight-place calculation precision instead of rounding a nonzero change to zero",()=>{expect(number(0.00000008)).toBe("0.00000008");expect(number(0)).toBe("0");expect(number(null)).toBe("—");});
