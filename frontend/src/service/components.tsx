import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ProductScreenFrame } from "../features/youtube-consent/ProductScreenFrame";
import { useSession } from "./SessionProvider";
import { ApiError, errorText, type Metric } from "./api";
export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const { generation } = useSession();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<{
    key: string;
    generation: number;
    data?: T;
    error?: unknown;
  }>({ key: "", generation: -1 });
  useEffect(() => {
    const cancel = new AbortController();
    setState({ key, generation });
    load(cancel.signal)
      .then((data) => {
        if (!cancel.signal.aborted) setState({ key, generation, data });
      })
      .catch((error) => {
        if (!cancel.signal.aborted) setState({ key, generation, error });
      });
    return () => cancel.abort();
  }, [key, generation, reload]);
  const active: { data?: T; error?: unknown } =
    state.key === key && state.generation === generation ? state : {};
  return {
    data: active.data,
    error: active.error,
    loading: active.data === undefined && active.error === undefined,
    retry: () => setReload((x) => x + 1),
  };
}
export function StatePanel({
  loading = false,
  error,
  empty = false,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  retry?: () => void;
}) {
  if (!loading && !error && !empty) return null;
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <section
      className={`dashboard-state-panel state-${loading ? "loading" : error ? "failed" : "empty"}`}
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      <h2>
        {loading
          ? "관측 데이터를 불러오고 있습니다."
          : missing
            ? "데이터를 찾을 수 없습니다."
            : error
              ? "데이터를 불러오지 못했습니다."
              : "표시할 관측 데이터가 없습니다."}
      </h2>
      <p>
        {error
          ? errorText(error)
          : empty
            ? "조건에 맞는 데이터가 없습니다. 조건을 바꿔 다시 확인해 주세요."
            : "잠시만 기다려 주세요."}
      </p>
      {Boolean(error) && retry && (
        <button className="primary-action" onClick={retry}>
          다시 시도
        </button>
      )}
    </section>
  );
}
export function Frame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const session = useSession();
  const location = useLocation();
  const [error, setError] = useState("");
  return (
    <ProductScreenFrame
      title={title}
      service
      actions={
        session.status === "authenticated" ? <button
          className="back-button"
          onClick={() => {
            void session.logout().catch((e) => setError(errorText(e)));
          }}
        >
          로그아웃
        </button> : <Link className="back-button" to="/login"
          state={{ from: location.pathname + location.search }}>로그인</Link>
      }
    >
      {error && <p role="alert">{error}</p>}
      {children}
    </ProductScreenFrame>
  );
}
export const number = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : value.toLocaleString("ko-KR", { maximumFractionDigits: 8 });
export const time = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) +
      " KST"
    : "관측 시각 없음";
export function metric(value: Metric | undefined) {
  return !value || value.availability === "UNAVAILABLE"
    ? "데이터 미지원"
    : value.availability === "EMPTY"
      ? "관측 없음"
      : number(value.value);
}
export function Unavailable({
  title,
  reason,
}: {
  title: string;
  reason: string;
}) {
  return (
    <section className="trend-chart-panel">
      <h2>{title}</h2>
      <p className="chart-caption">데이터 미지원 · {reason}</p>
    </section>
  );
}
export function ObservedChart({
  title,
  points,
  unit = "명",
  invert = false,
}: {
  title: string;
  points: { at: string; value: number }[];
  unit?: string;
  invert?: boolean;
}) {
  const values = points
    .filter(
      (p) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.at)),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const current = values[Math.min(index, values.length - 1)];
  if (!values.length)
    return (
      <Unavailable title={title} reason="비교할 실제 관측점이 없습니다." />
    );
  const start = Date.parse(values[0].at),
    span = Math.max(1, Date.parse(values.at(-1)!.at) - start),
    low = invert ? 1 : Math.min(0, ...values.map((p) => p.value)),
    high = Math.max(low + 1, ...values.map((p) => p.value));
  const x = (at: string) => 48 + ((Date.parse(at) - start) / span) * 900,
    y = (n: number) =>
      invert
        ? 24 + ((n - low) / (high - low)) * 210
        : 234 - ((n - low) / (high - low)) * 210;
  function inspect(clientX: number) {
    const box = ref.current!.getBoundingClientRect();
    const target =
      start +
      Math.max(
        0,
        Math.min(
          1,
          (clientX - box.left - box.width * 0.048) / (box.width * 0.9),
        ),
      ) *
        span;
    let closest = 0;
    for (let i = 1; i < values.length; i++)
      if (
        Math.abs(Date.parse(values[i].at) - target) <
        Math.abs(Date.parse(values[closest].at) - target)
      )
        closest = i;
    setIndex(closest);
  }
  return (
    <section className="trend-chart-panel">
      <div className="section-heading-row">
        <div>
          <h2>{title}</h2>
          <p>실제 관측점 · {invert ? "1위가 위쪽" : "빈 슬롯을 채우지 않음"}</p>
        </div>
      </div>
      <div className="observed-plot" ref={ref}>
        <svg
          viewBox="0 0 1000 280"
          role="group"
          aria-label={title + " 관측점 탐색"}
          tabIndex={0}
          onPointerMove={(e) => inspect(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setIndex((i) =>
                Math.max(
                  0,
                  Math.min(
                    values.length - 1,
                    i + (e.key === "ArrowRight" ? 1 : -1),
                  ),
                ),
              );
            }
          }}
        >
          <line
            x1="48"
            y1="234"
            x2="948"
            y2="234"
            stroke="var(--border-default)"
          />
          <text x="4" y="22">
            {number(invert ? low : high)}
          </text>
          <text x="4" y="252">
            {number(invert ? high : low)}
          </text>
          <polyline
            fill="none"
            stroke="var(--chart-bar-primary)"
            strokeWidth="2"
            points={values.map((p) => `${x(p.at)},${y(p.value)}`).join(" ")}
          />
          {values.map((p, i) => (
            <circle
              key={p.at + ":" + i}
              cx={x(p.at)}
              cy={y(p.value)}
              r="3"
              fill="var(--chart-bar-primary)"
            />
          ))}
          <line
            x1={x(current.at)}
            x2={x(current.at)}
            y1="24"
            y2="234"
            stroke="var(--text-secondary)"
            strokeDasharray="4"
          />
          <circle
            cx={x(current.at)}
            cy={y(current.value)}
            r="5"
            fill="var(--text-primary)"
          />
        </svg>
        <output
          className="observed-tooltip"
          style={{
            left: `clamp(0px, ${x(current.at) / 10}%, calc(100% - 190px))`,
          }}
          aria-live="polite"
        >
          {time(current.at)}
          <br />
          {number(current.value)}
          {unit}
        </output>
      </div>
      <p className="chart-caption">
        ← → 키 또는 포인터로 실제 관측점을 탐색할 수 있습니다. {values.length}개
        관측
      </p>
    </section>
  );
}
