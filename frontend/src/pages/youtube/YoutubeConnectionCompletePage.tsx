import { Link, useNavigate } from "react-router-dom";

import { getRoute } from "../../app/routeDefinitions";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";
import { useYoutubeConsent } from "../../features/youtube-consent/YoutubeConsentProvider";

export function YoutubeConnectionCompletePage() {
  const navigate = useNavigate();
  const { status, expire, disconnect } = useYoutubeConsent();
  const approved = status === "approved";

  function handleReconnect() {
    navigate(getRoute("YU-02").href);
  }

  function handleDisconnect() {
    disconnect();
    navigate(getRoute("YU-02").href);
  }

  return (
    <ProductScreenFrame title="채널 권한 승인 완료">
      {approved ? (
        <section
          aria-labelledby="approval-title"
          aria-live="polite"
          className="approval-card"
          role="status"
        >
          <div className="connection-state-row">
            <span className="simulation-pill">DEMO / SIMULATED</span>
            <span className="approved-pill">시뮬레이션 연결 완료</span>
          </div>
          <h2 id="approval-title">NEXUS 공식 채널이 연결된 것으로 시뮬레이션했습니다.</h2>
          <p className="approval-description">
            실제 계정 인증이나 채널 확인이 아닙니다. 로컬 UI에서 채널 식별 · 공개 영상 조회 · 허가된 댓글 접근을 승인한 것으로만 처리했습니다.
          </p>
          <article className="channel-confirmation">
            <div>
              <h3>채널 확인</h3>
              <p>NEXUS 공식 · @NEXUS_OFFICIAL · 읽기 전용 · 데모 데이터</p>
            </div>
            <span className="permission-badge">SIMULATED</span>
          </article>
          <aside className="login-separation-note" aria-label="서비스 로그인 상태 안내">
            <strong>YUTOPIA 서비스 로그인과 별도 상태입니다.</strong>
            <p>이 승인은 새로고침 시 사라지며 자격 증명, 액세스 토큰 또는 채널 비밀을 저장하지 않습니다.</p>
          </aside>
          <div className="approval-actions">
            <button className="secondary-action danger" onClick={expire} type="button">
              승인 만료 시뮬레이션
            </button>
            <button className="secondary-action" onClick={handleDisconnect} type="button">
              연결 해제
            </button>
            <Link className="primary-action" to={getRoute("YU-04").href}>
              관측 프로젝트 만들기 →
            </Link>
          </div>
        </section>
      ) : (
        <section aria-labelledby="guard-title" className="approval-card approval-guard">
          <span className="simulation-pill">DEMO / SIMULATED</span>
          <h2 id="guard-title">
            {status === "expired"
              ? "시뮬레이션 승인이 만료되었습니다."
              : "승인 상태를 확인할 수 없습니다."}
          </h2>
          <p aria-live="assertive" className="approval-description" role="alert">
            직접 주소로 들어오거나 새로고침한 경우 승인 완료 상태를 만들지 않습니다. 실제 OAuth나 YouTube 연결도 수행되지 않았습니다.
          </p>
          <button className="primary-action" onClick={handleReconnect} type="button">
            {status === "expired" ? "다시 연결" : "권한 검토로 돌아가기"}
          </button>
        </section>
      )}
    </ProductScreenFrame>
  );
}
