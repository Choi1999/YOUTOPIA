/**
 * UI-R03/R04 — decorative CSS 3D hero, not a data chart or a WebGL scene.
 * It makes no provider requests, starts no render loop, and exposes no
 * fabricated analytics. Motion is disabled with prefers-reduced-motion.
 */
export function WorkspaceHero() {
  return (
    <header className="product-heading workspace-hero">
      <div className="workspace-hero__copy">
        <p className="workspace-hero__eyebrow">
          <span className="workspace-hero__signal" aria-hidden="true" />
          YOUTOPIA / SIGNAL INTELLIGENCE
        </p>
        <h1>통합 분석 워크스페이스</h1>
        <p className="workspace-hero__headline">
          반응을 읽는<br />
          <strong>새로운 시야.</strong>
        </p>
        <p className="workspace-hero__description">
          영상과 채널, 주제 사이의 흐름을 하나의 관점에서 살펴보세요.
          검증된 합성 표본의 범위와 한계를 함께 보여줍니다.
        </p>
        <nav className="workspace-hero__actions" aria-label="워크스페이스 빠른 이동">
          <a className="workspace-hero__primary" href="#workspace-session">분석 구성하기 <span aria-hidden="true">↗</span></a>
          <a className="workspace-hero__secondary" href="#workspace-catalog">분석 대상 탐색</a>
        </nav>
        <div className="workspace-hero__meta" aria-label="시연 데이터 범위">
          <span><b>04</b> REGISTERED VIDEOS</span>
          <span><b>02</b> SYNTHETIC CHANNELS</span>
          <span><b>OFFLINE</b> DEMO ONLY</span>
        </div>
      </div>
      <div className="workspace-hero__visual" aria-hidden="true">
        <div className="workspace-hero__halo" />
        <div className="workspace-hero__orbit workspace-hero__orbit--outer" />
        <div className="workspace-hero__orbit workspace-hero__orbit--inner" />
        <div className="workspace-hero__ring workspace-hero__ring--a" />
        <div className="workspace-hero__ring workspace-hero__ring--b" />
        <div className="workspace-hero__orb" />
        <span className="workspace-hero__satellite workspace-hero__satellite--one" />
        <span className="workspace-hero__satellite workspace-hero__satellite--two" />
        <span className="workspace-hero__satellite workspace-hero__satellite--three" />
        <span className="workspace-hero__diagram-label workspace-hero__diagram-label--one">VIDEO / 04</span>
        <span className="workspace-hero__diagram-label workspace-hero__diagram-label--two">CHANNEL / 02</span>
      </div>
    </header>
  );
}
