import { NavLink, Outlet } from "react-router-dom";

import brandDark from "../assets/navigation/brand.svg";
import brandLight from "../assets/navigation/brand-light.svg";
import collectionDark from "../assets/navigation/collection.svg";
import collectionLight from "../assets/navigation/collection-light.svg";
import eventsDark from "../assets/navigation/events.svg";
import eventsLight from "../assets/navigation/events-light.svg";
import keywordsDark from "../assets/navigation/keywords.svg";
import keywordsLight from "../assets/navigation/keywords-light.svg";
import overviewDark from "../assets/navigation/overview.svg";
import overviewLight from "../assets/navigation/overview-light.svg";
import projectDark from "../assets/navigation/project.svg";
import projectLight from "../assets/navigation/project-light.svg";
import reactionsDark from "../assets/navigation/reactions.svg";
import reactionsLight from "../assets/navigation/reactions-light.svg";
import searchDark from "../assets/navigation/search.svg";
import searchLight from "../assets/navigation/search-light.svg";
import settingsDark from "../assets/navigation/settings.svg";
import settingsLight from "../assets/navigation/settings-light.svg";
import steamDark from "../assets/navigation/steam.svg";
import steamLight from "../assets/navigation/steam-light.svg";
import youtubeDark from "../assets/navigation/youtube.svg";
import youtubeLight from "../assets/navigation/youtube-light.svg";
import { getRoute } from "../app/routeDefinitions";

type NavigationIconProps = {
  dark: string;
  light: string;
};

/**
 * 테마에 맞는 탐색 아이콘을 표시한다.
 * Dark/Light 이미지의 실제 노출 여부는 CSS에서 제어한다.
 */
function NavigationIcon({ dark, light }: NavigationIconProps) {
  return (
    <span aria-hidden="true" className="navigation-icon">
      <img className="icon-dark" src={dark} />
      <img className="icon-light" src={light} />
    </span>
  );
}

const groups = [
  {
    label: "관측",
    items: [
      { label: "대시보드", route: getRoute("YU-06"), dark: overviewDark, light: overviewLight },
      { label: "프로젝트", route: getRoute("YU-04"), dark: projectDark, light: projectLight },
    ],
  },
  {
    label: "플랫폼",
    items: [
      { label: "채널 연결", route: getRoute("YU-02"), dark: steamDark, light: steamLight },
      { label: "댓글 분석", route: getRoute("YU-07"), dark: youtubeDark, light: youtubeLight },
    ],
  },
  {
    label: "분석",
    items: [
      { label: "트렌드 관측", route: getRoute("YU-08"), dark: reactionsDark, light: reactionsLight },
      { label: "근거 검증", route: getRoute("YU-09"), dark: keywordsDark, light: keywordsLight },
      { label: "이슈 관리", route: getRoute("YU-11"), dark: eventsDark, light: eventsLight },
    ],
  },
];

/**
 * 공통 사이드바의 메뉴 항목.
 * NavLink를 사용하여 현재 URL의 활성 상태를 표시한다.
 */
function NavigationItem({
  label,
  href,
  dark,
  light,
}: {
  label: string;
  href: string;
  dark: string;
  light: string;
}) {
  return (
    <NavLink
      className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
      title={label}
      to={href}
    >
      <NavigationIcon dark={dark} light={light} />
      <span className="sidebar-label">{label}</span>
    </NavLink>
  );
}

/**
 * 로그인 페이지를 제외한 주요 내부 화면의 공통 레이아웃.
 *
 * 사이드바와 본문 영역을 구성하며,
 * 선택된 하위 페이지를 Outlet에 표시한다.
 *
 * 데이터 조회와 접근 권한 검증은 담당하지 않는다.
 */
export function AppShell() {
  const reportRoute = getRoute("YU-12");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="app-sidebar" aria-label="YUTOPIA 주 탐색">
        <div className="sidebar-brand">
          <NavigationIcon dark={brandDark} light={brandLight} />
          <strong className="sidebar-brand-copy">YUTOPIA</strong>
        </div>

        <label className="sidebar-search">
          <span className="sr-only">게임 검색</span>
          <NavigationIcon dark={searchDark} light={searchLight} />
          <input disabled placeholder="게임 검색" type="search" />
        </label>

        <nav className="sidebar-navigation">
          {groups.map((group) => (
            <section className="sidebar-group" key={group.label}>
              <h2 className="sidebar-group-label">{group.label}</h2>
              {group.items.map((item) => (
                <NavigationItem
                  dark={item.dark}
                  href={item.route.href}
                  key={item.route.code}
                  label={item.label}
                  light={item.light}
                />
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-operations">
          <span className="sidebar-group-label">운영</span>
          <NavigationItem
            dark={collectionDark}
            href={reportRoute.href}
            label="AI · 보고서"
            light={collectionLight}
          />
          <button aria-disabled="true" className="sidebar-link" disabled title="설정" type="button">
            <NavigationIcon dark={settingsDark} light={settingsLight} />
            <span className="sidebar-label">설정</span>
          </button>
        </div>
      </aside>
      <main className="app-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
