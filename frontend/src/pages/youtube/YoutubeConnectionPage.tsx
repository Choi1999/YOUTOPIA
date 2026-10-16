import { useNavigate } from "react-router-dom";

import { getRoute } from "../../app/routeDefinitions";
import { PermissionList } from "../../features/youtube-consent/PermissionList";
import { ProductScreenFrame } from "../../features/youtube-consent/ProductScreenFrame";
import {
  useYoutubeConsent,
  type YoutubeConsentStatus,
} from "../../features/youtube-consent/YoutubeConsentProvider";

const outcomeCopy: Partial<Record<YoutubeConsentStatus, { title: string; description: string }>> = {
  denied: {
    title: "권한 요청이 거부되었습니다.",
    description: "어떤 Google 또는 YouTube 계정에도 연결하지 않았습니다. 권한을 다시 검토할 수 있습니다.",
  },
  cancelled: {
    title: "권한 검토가 취소되었습니다.",
    description: "취소는 서비스 로그인에 영향을 주지 않습니다. YouTube 채널 연결은 여전히 선택 사항입니다.",
  },
  expired: {
    title: "시뮬레이션 승인이 만료되었습니다.",
    description: "만료 상태에서는 수집이나 다음 단계 승인을 주장하지 않습니다. 다시 검토해 주세요.",
  },
};

export function YoutubeConnectionPage() {
  const navigate = useNavigate();
  const { status, beginReview, approve, deny, cancel } = useYoutubeConsent();
  const outcome = outcomeCopy[status];

  function handleApproval() {
    approve();
    navigate(getRoute("YU-03").href);
  }

  return (
    <ProductScreenFrame title="YouTube 채널 연결 · 권한 요청">
      <div className="consent-layout">
        <section aria-labelledby="channel-title" className="channel-panel">
          <div className="connection-state-row">
            <span className="simulation-pill">DEMO / SIMULATED</span>
            <span className="connection-state">
              {status === "review" ? "권한 검토 중" : outcome ? "연결 안 됨" : "연결 안 됨"}
            </span>
          </div>

          <label id="channel-title" htmlFor="demo-channel">공식 채널</label>
          <input
            id="demo-channel"
            readOnly
            value="NEXUS 공식 YouTube 채널"
          />

          <div className="consent-notes">
            <p>채널 전용 데이터는 승인 전 수집할 수 없습니다. 공개 데이터 관측 경로와는 분리됩니다.</p>
            <p>개인정보와 YouTube 이용 조건을 준수합니다.</p>
          </div>

          <aside className="login-separation-note" aria-label="로그인과 채널 권한 구분">
            <strong>서비스 로그인과 YouTube 권한은 서로 다릅니다.</strong>
            <p>
              현재 YUTOPIA 로그인은 브라우저 데모입니다. 아래 채널 권한 검토는 선택적인 로컬 시뮬레이션이며 공개 영상 관측에 OAuth가 필요한지는 아직 정책 결정 전입니다.
            </p>
          </aside>

          {outcome && (
            <div aria-live="polite" className={`consent-outcome ${status}`} role="status">
              <strong>{outcome.title}</strong>
              <p>{outcome.description}</p>
              <button className="secondary-action" onClick={beginReview} type="button">
                권한 다시 검토
              </button>
            </div>
          )}

          {status === "review" ? (
            <section aria-labelledby="review-title" className="consent-review">
              <span className="simulation-pill">DEMO 권한 검토</span>
              <h2 id="review-title">선택한 읽기 범위를 확인해 주세요.</h2>
              <p>
                이 동작은 로컬 React 상태만 변경합니다. Google 로그인 창을 열거나 토큰을 만들지 않습니다.
              </p>
              <div className="review-actions">
                <button className="primary-action" onClick={handleApproval} type="button">
                  시뮬레이션 승인
                </button>
                <button className="secondary-action danger" onClick={deny} type="button">
                  거부
                </button>
                <button className="secondary-action" onClick={cancel} type="button">
                  취소
                </button>
              </div>
            </section>
          ) : !outcome ? (
            <button className="primary-action consent-start" onClick={beginReview} type="button">
              Google 연결 · 권한 승인 →
            </button>
          ) : null}

          <p className="consent-next-copy">
            시뮬레이션 승인 이후에만 채널 상태 화면으로 이동할 수 있습니다.
          </p>
        </section>

        <PermissionList />
      </div>
    </ProductScreenFrame>
  );
}
