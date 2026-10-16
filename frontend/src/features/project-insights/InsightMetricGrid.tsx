export type InsightMetric = {
  label: string;
  value: string;
  note: string;
};

export function InsightMetricGrid({ metrics }: { metrics: InsightMetric[] }) {
  return (
    <section className="insight-metric-grid" aria-label="프로젝트 핵심 지표">
      {metrics.map((metric) => (
        <article className="insight-metric-card" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.note}</small>
        </article>
      ))}
    </section>
  );
}
