import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="route-code">404</p>
      <h1>요청한 YUTOPIA 화면을 찾을 수 없습니다.</h1>
      <p>등록되지 않은 경로이며 어떤 기능도 실행하지 않았습니다.</p>
      <Link className="primary-link" to="/login">로그인 화면으로 이동</Link>
    </main>
  );
}
