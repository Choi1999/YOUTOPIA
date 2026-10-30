const permissions = [
  { name: "채널 식별", description: "연결 대상으로 선택한 채널 표시" },
  { name: "영상 목록", description: "등록된 공개 영상 조회 범위 표시" },
  { name: "댓글 목록", description: "허가된 범위의 댓글 접근 표시" },
  { name: "관리 권한", description: "불필요한 수정 권한 요청하지 않음" },
];

export function PermissionList() {
  return (
    <section aria-labelledby="permission-title" className="permission-panel">
      <h2 id="permission-title">요청 권한</h2>
      <div className="permission-list">
        {permissions.map((permission) => (
          <article className="permission-row" key={permission.name}>
            <div>
              <h3>{permission.name}</h3>
              <p>{permission.description}</p>
            </div>
            <span className="permission-badge">조회</span>
          </article>
        ))}
      </div>
    </section>
  );
}
