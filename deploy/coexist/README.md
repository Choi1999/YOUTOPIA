# 기존 호스트에 공존하는 사전 빌드 배포

이 도구는 검토·패키징·명시적으로 승인한 운영 작업을 분리한다. 패키징이나
테스트 성공이 운영 설치·재시작·배포 승인을 뜻하지 않는다. 운영 SQL·비공개
인계자료·실제 비밀은 Git과 전달 묶음 밖에서 보관한다.

기존 계정·폴더·Java·nginx를 준비한 호스트는 **[RESUME.md](RESUME.md)**부터
진행한다. 계정·키·경로를 다시 만들거나 신규 설치 스크립트를 반복하지 않는다.
초기 준비가 전혀 없는 별도 호스트에만 [INSTALL-ORDER.md](INSTALL-ORDER.md)를 검토한다.
SSH 실패 때문에 키 재생성이나 환경 재게시를 반복하지 않는다([SSH.md](SSH.md)).

## 현재 Redis 계약

`compose.yaml`이 배포 이미지의 단일 기준이다. 테스트 fixture와 ACL/메모리
검증도 그 파일의 **정확한 버전과 digest**를 읽는다.

```text
public.ecr.aws/docker/library/redis:7.2.17-bookworm@sha256:0312984fbfeb2ff1d4382ecef45b50e7d65478a6a58cf12ce28d6de7a4142e45
```

실제 Redis 버전·UID999·linux/amd64를 격리 환경에서 확인한다. 다른 아키텍처는
해당 플랫폼의 회귀 검증이 필요하다. 버전 변경은 [SECURITY.md](SECURITY.md)의
공식 보안 권고·기반 OS 지원·테스트 범위를 함께 검토한다.

| 대상 | 경로·상한 |
|---|---|
| Spring | 비특권 `youtopia-app`, loopback8080, CPU150%, MemoryMax3GiB/swap0 |
| 신규 Redis | `youtopia-app-cache`, loopback6379, CPU0.5, 1GiB/swap0, PID128 |
| Redis 데이터 | `/srv/youtopia-data/redis`, 기존 DB 디렉터리와 분리 |
| Redis 정책 | maxmemory512MiB, noeviction, AOF everysec, 앱 ACL·만료 알림 |
| nginx | 기존 사이트 없음 조건의 새 전용 설정, CPU25%/256MiB 후보 |
| 릴리스 | `/opt/youtopia-app/releases/<source SHA>`, root 소유, 앱은 읽기만 |

이 상한은 기존 DB/수집/OS와 AOF COW 피크를 포함한 용량 보장이 아니다.
기존 DB의 포트·인증·네트워크·마운트·메모리 설정, Docker 저장소, cron과
Tailscale 경로를 보존한다. prune/볼륨 삭제/기존 컨테이너 재생성은 하지 않는다.

## 빌드와 전달

운영 서버에서 빌드·전체 테스트를 실행하지 않는다. 격리 환경에서
[VALIDATION.md](VALIDATION.md)를 통과한 뒤 실제 빌드 체크아웃을 기록한다.

```sh
python3 deploy/coexist/record-build-provenance.py build/build-provenance.json
python3 deploy/coexist/package-delivery.py --output-dir /absolute/new-delivery-directory
```

`record-build-provenance.py`는 빌드나 테스트를 실행했다고 주장하지 않는
기존 산출물의 기록 도구다. 실제 빌드된 깨끗한 체크아웃에서만 기록한다.
이후 배포 도구·문서만 변경되면 이전 기록을 사용할 수 있다. 패키징은 Git의
백엔드/프런트 빌드 입력과 산출물 해시를 비교해, 입력 또는 바이트가 바뀐 경우
재사용을 거부한다. `--build-provenance`로 기존 기록 파일을 명시할 수 있다.

릴리스 manifest의 `source_sha`는 배포 소스 커밋이고,
`build_provenance.build_source_sha`는 JAR·정적 파일의 실제 빌드 기준이다.
둘은 다를 수 있다. 같은 JAR 해시를 새 커밋에서 재빌드한 것처럼 표시하지 않는다.

전달 ZIP에는 앱 릴리스, 기존 호스트 재개용 도구, 소스/빌드 기준, 체크섬,
일반 PowerShell 업로드 도구와 문서만 포함한다. 완료한 계정·폴더·Java/nginx
신규 설치 도구는 기본 전달물에서 제외한다. Windows는 기존 전용 키와 검증된
known_hosts를 재사용한다([MANUAL-TRANSFER.md](MANUAL-TRANSFER.md)).

## 기동 전 게이트

실제 Domain/HTTPS·비밀 설정·Redis 인증/영속화/자원·수집 공존 수용이 필요하다.
회원 기능은 독립 authoritative control·최신 journal/키 복구·별도 운영자 권한과
fence 검증을 요구한다([CONTROL.md](CONTROL.md)). 같은 VM의 별도 DB/폴더만으로
VM 전체 복원 독립성을 주장하지 않는다. 조건 미충족 시 회원 기동을 보류한다.
control=false, 직접OPEN 또는 보호 필터 제거로 우회하지 않는다.

추가 유료 자원·구독·도메인을 자동 구매하지 않는다. `LEGAL_REVIEW`의
신규 탈퇴·최종 파기·reconciliation과 선택 query association은 별도 검토 전 off다.
구조 검사·합성 테스트는 운영 자격·control 독립성·전수 보안 검사·운영 수용을 대체하지 않는다.
