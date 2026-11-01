# 추가 구매 없는 공인 IP HTTPS 검토

일반 사용자가 Tailscale 없이 `https://PUBLIC_IPV4/`에 접속하는 안이다.
Tailscale 전용 HTTPS를 공인 인터넷 주소로 취급하지 않는다. 도메인/유료 인증서/
관리형 Redis/추가 VM을 신청하지 않는다.

## 공식 지원과 선택

Let’s Encrypt는2026-01-15부터 IPv4/IPv6 SAN을 포함한 IP 인증서를 일반 제공한다.
IP 인증서는 `shortlived` 프로필만 가능하며 유효기간160시간이다.
Certbot IP 지원은5.3, webroot IP 지원은5.4 이상이다.2026-11-02 검토한
공식 최신5.9.0 이미지를 `certbot-image.txt`에 digest로 고정했다.
갱신/발급은 webroot이며 nginx installer plugin으로 설정을 자동 수정하지 않는다.
`--required-profile shortlived`로 프로필 미지원 시 중단한다.

- https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability/
- https://letsencrypt.org/2026/03/11/shorter-certs-certbot/
- https://github.com/certbot/certbot/releases/tag/v5.9.0
- https://github.com/certbot/certbot/blob/v5.9.0/certbot/docs/using.rst

공인 IPv4가 해당 서버로 안정적으로 연결되고 인터넷의80/443 접근이 가능해야 한다.
ACG/NAT/기존 listener 확인 전 가능하다고 확정하지 않는다. IP가 바뀌면 새 IP로
다시 검증·발급해야 한다. 인증서의 IP SAN/전체 chain/브라우저 신뢰를 실제로 확인한다.

## 도구 범위와 순서

`render-ip-https.py APPROVED_PUBLIC_IPV4 NEW_REVIEW_DIRECTORY`는 파일만 만든다.
HTTP challenge 전용 설정은 API/앱/로그인을 제공하지 않고 다른 경로는404다.
최종 HTTPS 설정도 HTTP challenge 경로만 redirect에서 제외한다.
IP literal의 TLS SNI 부재를 고려해443 default_server를 쓰므로 기존 기본 vhost와
충돌/기존 사이트 영향부터 확인한다. 이미 설치한 nginx를 재설치하지 않는다.

`certbot-ip.sh staging|issue|renew|check`는 **향후 별도 승인한 root 실행용**이다.
별도 Certbot 컨테이너만 일시 실행하며 Docker daemon/기존 컨테이너를 업그레이드하지 않는다.
512MiB/CPU0.5/PID128, cap drop/read-only, 필요한 ACME 상태·webroot mount만 쓰며
Docker socket·앱/DB 비밀은 컨테이너에 넣지 않는다. 검증 플랫폼은 linux/amd64다.

1. 읽기 전용 호스트/후보 패키지/기존 nginx 사이트·mask·80/443/ACG 경로를 검토한다.
2. 승인 후 새 root 전용 ACME 폴더·공개 challenge root만 만든다. 기존 폴더는 대조한다.
3. challenge 전용 vhost를 nginx -t로 확인한 후 승인한 범위에서만 unmask/start한다.
   이것은 아직 앱/회원 기동 승인이 아니다.
4. staging은 별도 `/etc/youtopia-acme/staging/{config,work,logs}`에만 발급한다.
   staging chain은 브라우저가 신뢰하지 않으므로 운영443에 설치하지 않는다.
5. staging 성공·독립 접근 확인 후 production `issue`를 실행한다. 기존 lineage는 덮지 않는다.
   갱신 이외의 초기 발급 경로는 기존 `youtopia-ip` lineage가 있으면 중단한다.
6. certbot 저장소·계정키·로그는 root0700, 키파일은0600으로 관리한다.
   앱 계정/전용 배포 계정에 키·Docker 권한을 주지 않는다.
7. 6시간 timer로 갱신을 확인한다. 인증서가 바뀌고 IP/유효기간·nginx -t가 통과하며
   nginx가 이미 active인 경우만 reload한다. inactive면 자동 start/unmask하지 않는다.
8. `check`는 IP SAN과48시간 이상 남은 유효기간을 확인한다. 갱신 실패/48시간 미만은
   unit failure로 남긴다. 운영자가 timer 상태·private log·외부443 인증서 만료를 감시해야 한다.
   실패를 self-signed/HTTP 로그인/TLS 검증 해제로 대체하지 않는다.

최종 앱 ingress는 control·비밀·실제 역할/Redis·수집 공존 수용과 별도 기동 승인이
끝난 후 적용한다. TLS 갱신 rollback은 설정/검증한 이전 유효 인증서로 한정한다.
만료된 인증서나 취약 패키지로 자동 복원하지 않는다. 신규 timer/vhost만 중지/복구하고
기존 DB·수집·Tailscale은 바꾸지 않는다. 자세한 대상/명령은 SERVER-REVIEW.md에 있다.

현재 격리 검증은 CLI 옵션·nginx 설정/경로·갱신 hook 경계다. 실제 공인 IP의
ACME challenge/production 발급/자동 갱신/브라우저 신뢰는 서버에서 아직 미검증이다.
