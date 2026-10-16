import {
  DEMO_COMPARISON_WINDOWS,
  DEMO_OBSERVATION_WINDOW,
  DEMO_SOURCE,
} from "../project-demo/nexusDemoData";

export function DataProvenance({ sourceIds }: { sourceIds: string[] }) {
  return (
    <aside className="data-provenance" aria-label="데모 데이터 출처와 범위">
      <div>
        <strong>출처 · 범위</strong>
        <p>{DEMO_SOURCE.name} · {DEMO_SOURCE.attribution}</p>
      </div>
      <dl>
        <div><dt>전체 관측 창</dt><dd>{DEMO_OBSERVATION_WINDOW.start}~{DEMO_OBSERVATION_WINDOW.end}</dd></div>
        <div><dt>14일 비교 창</dt><dd>{DEMO_COMPARISON_WINDOWS.before.start}~{DEMO_COMPARISON_WINDOWS.before.end} / {DEMO_COMPARISON_WINDOWS.after.start}~{DEMO_COMPARISON_WINDOWS.after.end}</dd></div>
        <div><dt>관측 시각</dt><dd>{DEMO_SOURCE.observedAt}</dd></div>
        <div><dt>소스 ID</dt><dd>{sourceIds.join(", ")}</dd></div>
      </dl>
    </aside>
  );
}
