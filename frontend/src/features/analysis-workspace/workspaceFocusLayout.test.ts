import { describe, expect, it } from "vitest";
import {
  FOCUS_DOCK_LAYOUT_KEY, FOCUS_LIST_MIN, FOCUS_DETAIL_MIN,
  clampFocusDockLayout, focusDockBounds, readFocusDockLayout,
  resizeFocusDockLayout, writeFocusDockLayout,
} from "./workspaceFocusLayout";

describe("UI-R04-J — bounded, session-only dock layout", () => {
  it("keeps a minimum central graph budget when both docks are open", () => {
    const result = clampFocusDockLayout(
      { list: 480, detail: 480 }, 1101, true, true,
    );
    expect(result.list).toBeGreaterThanOrEqual(FOCUS_LIST_MIN);
    expect(result.detail).toBeGreaterThanOrEqual(FOCUS_DETAIL_MIN);
    expect(result.list + result.detail).toBeLessThanOrEqual(1101 - 360 - 90);
    expect(clampFocusDockLayout({ list: 480, detail: 480 }, 1440, true, true))
      .toEqual({ list: 480, detail: 480 });
  });
  it("resizes the intended side without exceeding its available budget", () => {
    const starting = { list: 270, detail: 300 };
    const narrower = resizeFocusDockLayout(
      starting, "detail", 9999, 1101, true, true,
    );
    expect(narrower.detail).toBe(focusDockBounds("detail", 1101, true, 270).max);
    expect(narrower.list).toBe(270);
    expect(resizeFocusDockLayout(
      starting, "list", 100, 1440, true, true,
    ).list).toBe(FOCUS_LIST_MIN);
    expect(resizeFocusDockLayout(
      starting, "detail", 100, 1440, true, true,
    ).detail).toBe(FOCUS_DETAIL_MIN);
  });
  it("stores only exact, integer, bounded dock widths and clears on reset", () => {
    const storage = window.sessionStorage;
    storage.clear();
    expect(readFocusDockLayout(storage)).toBeNull();
    writeFocusDockLayout(storage, { list: 290, detail: 310 });
    expect(readFocusDockLayout(storage)).toEqual({ list: 290, detail: 310 });
    for (const invalid of [
      "{", JSON.stringify({ version: 1, list: "290", detail: 310 }),
      JSON.stringify({ version: 1, list: 291.5, detail: 310 }),
      JSON.stringify({ version: 1, list: 290, detail: 99999 }),
      JSON.stringify({ version: 1, list: 290, detail: 310, token: "bad" }),
      JSON.stringify({ version: 2, list: 290, detail: 310 }),
    ]) {
      storage.setItem(FOCUS_DOCK_LAYOUT_KEY, invalid);
      expect(readFocusDockLayout(storage)).toBeNull();
    }
    writeFocusDockLayout(storage, null);
    expect(storage.getItem(FOCUS_DOCK_LAYOUT_KEY)).toBeNull();
  });
  it("fails safely when storage access is blocked", () => {
    const blocked = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    } as unknown as Storage;
    expect(readFocusDockLayout(blocked)).toBeNull();
    expect(() => writeFocusDockLayout(blocked, { list: 270, detail: 300 }))
      .not.toThrow();
    expect(() => writeFocusDockLayout(blocked, null)).not.toThrow();
  });
});
