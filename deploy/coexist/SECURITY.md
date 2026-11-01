# 배포 보안 기준

## Redis 버전과 기반 OS

2026-11-01 검토 기준으로 Redis7.2.13에는 CVE-2026-25243의7.2.14 수정이 없다.
RESTORE ACL 차단은 노출을 줄이는 조건이며 오래된 바이너리 유지 사유가 아니다.
7.2.15/16/17의 후속 보안 수정까지 포함한 **7.2.17-bookworm**을 Compose에 고정했다.

- [Redis7.2 릴리스 노트](https://github.com/redis/redis/blob/7.2/00-RELEASENOTES)
- [CVE-2026-25243 공식 GHSA](https://github.com/redis/redis/security/advisories/GHSA-c8h9-259x-jff4)
- [Redis OSS 지원 정책](https://redis.io/docs/latest/operate/oss_and_stack/install/version-mgmt/)
- [Docker Official Images Redis 메타데이터](https://github.com/docker-library/official-images/blob/master/library/redis)

현재7.2.17의 Alpine 태그 기반3.21은2026-11-01 지원 종료이므로 Bookworm을 선택했다.
Redis7.2 OSS의 연장 지원과 Redis Enterprise 제품의 수명을 혼동하지 않는다.
기반 OS의 LTS도 모든 패키지의 무취약 보증은 아니다.

- [Alpine release branches](https://alpinelinux.org/releases/)
- [Bookworm LTS 전환과2028-06-30 지원 종료](https://www.debian.org/News/2026/20260712)

새 이미지/플랫폼 선택 시 실제 버전·UID·아키텍처와 ACL·세션·영속화·자원·장애
검증을 다시 실행한다. 지금의 격리 검증 플랫폼은 linux/amd64다. 다른 플랫폼의
성공을 추정하지 않는다. `redis_contract.py`가 floating tag/누락 digest를 거부한다.

## 버전·실행 조건·검사 범위

호스트 Java/nginx/PostgreSQL/PHP는 실제 전체 버전·이미지 ID/digest·확장·모듈과
실행 경로를 조회한다. Ubuntu는 짧은 upstream 버전만으로 판정하지 않고 전체
패키지 버전·백포트/회귀 이력·공식 USN과 대조한다. 예를 들어 nginx42533 수정은
적용/회귀/재수정 이력이 있어 최초 수정 버전 이상이라는 비교만으로 부족하다.

- [Ubuntu nginx 공지 USN-8955-1](https://ubuntu.com/security/notices/USN-8955-1)
- [Ubuntu OpenJDK21 공지 USN-8796-1](https://ubuntu.com/security/notices/USN-8796-1)
- [PostgreSQL16 공식 보안 목록](https://www.postgresql.org/support/security/16/)
- [Spring 공식 보안 공지](https://spring.io/security/)
- [Tomcat11 공식 보안 목록](https://tomcat.apache.org/security-11.html)

`inspect-host.sh`는 캐시된 apt 후보를 읽는다. 패키지 목록 갱신은 별도의 쓰기
동작이며 실제 패키지 업그레이드·서비스 재시작과 구분한다. 이 조회 도구는 어떤
갱신/업그레이드/서비스 변경도 실행하지 않는다.

React의 plain 클라이언트 버전과 react-server-dom-*를 구분한다. 현재 프런트는
createRoot/Vite plugin-react의 정적 산출물이며 RSC 패키지/플러그인/Node 서버를
배포하지 않는다. PHP도 앱 경로에는 없다. 서버의 다른 site/프로세스 존재 여부는
별도 조회하기 전 미확인이다. 미사용 기술을 이 앱의 결함으로 합산하지 않는다.

- [React RSC 공식 공지와 비서버 앱의 비해당 조건](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3)

보고는 영향 있음·영향 없음·조건부·미확인으로 구분하고 버전·조건·출처·조치·회귀
근거를 남긴다. dependency DB의 특정 좌표 조회에서 매칭이 없다는 사실을 전체
서버·컨테이너 파일시스템·정적 링크/vendored 구성요소까지의 무취약 선언으로 바꾸지 않는다.
전수 검사가 없다면 “알려진 취약점0건”으로 보고하지 않는다.
