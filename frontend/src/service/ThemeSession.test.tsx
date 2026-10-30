import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme/ThemeProvider";
import { ThemeSelector } from "../theme/ThemeSelector";
import { ServiceSessionContext } from "./SessionProvider";
import { ApiError, serviceApi, type Settings } from "./api";
const A = "00000000-0000-0000-0000-000000000001",
  B = "00000000-0000-0000-0000-000000000002";
function Provider({
  account,
  generation = 1,
}: {
  account: string | null;
  generation?: number;
}) {
  return (
    <ServiceSessionContext.Provider
      value={{
        status: account ? "authenticated" : "guest",
        identity: account
          ? { id: account, kind: "USER", emailVerified: false }
          : null,
        generation,
        refresh: async () => {},
        login: async () => {},
        logout: async () => {},
      }}
    >
      <ThemeProvider>
        <ThemeSelector />
      </ThemeProvider>
    </ServiceSessionContext.Provider>
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("uses effective system default and responds to the OS without storing it as another account's preference", async () => {
  let listener = () => {};
  const media = {
    matches: false,
    addEventListener: (_event: string, callback: () => void) => {
      listener = callback;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media);
  render(<Provider account={null} />);
  expect(screen.getByRole("button", { name: "시스템" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(document.documentElement.dataset.theme).toBe("light");
  act(() => {
    media.matches = true;
    listener();
  });
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("yutopia-theme")).toBeNull();
});
it("ignores a delayed settings response from the previous account", async () => {
  let resolveA!: (v: Settings) => void;
  vi.spyOn(serviceApi, "settings").mockImplementation((account) =>
    account === A
      ? new Promise((resolve) => {
          resolveA = resolve;
        })
      : Promise.resolve({ version: 0, values: { theme: "light" } }),
  );
  const view = render(<Provider account={A} />);
  view.rerender(<Provider account={B} generation={2} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "라이트" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  await act(async () => resolveA({ version: 9, values: { theme: "dark" } }));
  expect(screen.getByRole("button", { name: "라이트" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("restores the anonymous choice after logout instead of persisting a user's server setting", async () => {
  localStorage.setItem("yutopia-theme", "dark");
  vi.spyOn(serviceApi, "settings").mockResolvedValue({
    version: 1,
    values: { theme: "light" },
  });
  const view = render(<Provider account={A} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "라이트" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(localStorage.getItem("yutopia-theme")).toBe("dark");
  view.rerender(<Provider account={null} generation={2} />);
  expect(screen.getByRole("button", { name: "다크" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("sends a revision and refreshes after a conflict without silently overwriting", async () => {
  vi.spyOn(serviceApi, "settings")
    .mockResolvedValueOnce({ version: 0, values: { theme: "system" } })
    .mockResolvedValueOnce({ version: 1, values: { theme: "light" } });
  const save = vi
    .spyOn(serviceApi, "saveTheme")
    .mockRejectedValue(new ApiError(409, "SETTINGS_CONFLICT"));
  render(<Provider account={A} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "다크" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "다크" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "라이트" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(save).toHaveBeenCalledExactlyOnceWith(A, 0, "dark");
});
it("does not apply an old PATCH response after an account switch", async () => {
  let finish!: (v: Settings) => void;
  vi.spyOn(serviceApi, "settings").mockResolvedValue({
    version: 0,
    values: { theme: "system" },
  });
  vi.spyOn(serviceApi, "saveTheme").mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(<Provider account={A} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "다크" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "다크" }));
  view.rerender(<Provider account={B} generation={2} />);
  await act(async () => finish({ version: 1, values: { theme: "dark" } }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "시스템" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
});
