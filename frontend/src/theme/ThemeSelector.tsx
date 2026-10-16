import { useTheme } from "./ThemeProvider";

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      aria-label="테마 선택"
      className={compact ? "theme-selector compact" : "theme-selector"}
      role="group"
    >
      <button
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        type="button"
      >
        다크
      </button>
      <button
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        type="button"
      >
        라이트
      </button>
    </div>
  );
}
