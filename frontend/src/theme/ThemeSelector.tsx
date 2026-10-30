import { useTheme } from "./ThemeProvider";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, allowSystem, pending, error } = useTheme();

  return (
    <div
      aria-label="테마 선택"
      className={compact ? "theme-selector compact" : "theme-selector"}
      role="group"
    >
      <button
        aria-pressed={theme === "dark"}
        disabled={pending}
        onClick={() => setTheme("dark")}
        type="button"
      >
        다크
      </button>
      <button
        aria-pressed={theme === "light"}
        disabled={pending}
        onClick={() => setTheme("light")}
        type="button"
      >
        라이트
      </button>
      {allowSystem && <button aria-pressed={theme === "system"} disabled={pending} onClick={() => setTheme("system")} type="button">시스템</button>}
      {error && <span className="sr-only" role="status">{error}</span>}
    </div>
  );
}
