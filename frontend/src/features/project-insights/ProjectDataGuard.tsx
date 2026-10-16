import { Link } from "react-router-dom";

import { getRoute } from "../../app/routeDefinitions";

export function ProjectDataGuard({ hasProject, title }: { hasProject: boolean; title: string }) {
  return (
    <section className="analysis-guard" aria-labelledby="project-data-guard-title">
      <span className="simulation-pill">DEMO / UNAVAILABLE</span>
      <h2 id="project-data-guard-title">{title}</h2>
      <p role="alert">
        직접 진입, 새로고침, 부분 수집 또는 실패 상태에서는 관측·검증 결과를 생성하지 않습니다.
      </p>
      <Link className="primary-action" to={getRoute(hasProject ? "YU-05" : "YU-04").href}>
        {hasProject ? "수집 상태 확인하기" : "프로젝트 생성으로 돌아가기"}
      </Link>
    </section>
  );
}
