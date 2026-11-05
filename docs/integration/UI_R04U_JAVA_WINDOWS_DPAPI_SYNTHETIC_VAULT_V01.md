# UI-R04-U — Java 21 Windows DPAPI 합성 키 보관소 · 오프라인 QA

작성일: 2026-11-05 KST

## 1. 범위

- 사용자 확정 개발 환경: Windows PC에 네이티브 Java 21/Spring Boot 직접 실행.
- 사용자가 보고한 공인 IP와 Google Cloud 키 제한 IP 일치·재연결 후 안정성은 신뢰할 만한 초기 운영자 보고이나 실제 Java 백엔드 프로세스의 출구 IP에 대한 독립 검증은 아니다.
- 부모: 미병합 Draft PR #84의 HEAD 785d7b620e22c89ae81d948177cc35681f894f7d.
- 앞선 UI-R04-T는 PowerShell의 합성 문자열 DPAPI 왕복만 검증했다. 이번 PR은 별도의 **Java 네이티브 DPAPI 암호화/복원 저장소 코어**를 구현해 합성 키만 저장·읽기·회전·삭제한다.
- **실 YouTube API 키 저장·읽기, Cloud/YouTube 호출, 서비스 활성화, 키 발급, 정책 게이트 해제, 병합 및 배포는 허용되지 않으며 실행하지 않았다.**

## 2. 구현 파일

| 파일 | 동작 |
|---|---|
| src/main/java/com/youtopia/youtube/metadata/WindowsDpapiSyntheticVault.java | Java → JNA 5.19.1 → Windows CryptProtectData/CryptUnprotectData 직접 사용. CurrentUser 범위만 사용하고 UI prompt 금지 |
| src/test/java/com/youtopia/youtube/metadata/WindowsDpapiSyntheticVaultTest.java | 실제 Windows의 합성 키 보호·복원·회전·삭제·ACL·손상 거부 및 byte[] zeroing 검증 |
| .github/workflows/ui-r04u-windows-native-dpapi-vault.yml | Windows-latest Java 21 native DPAPI 시험 및 정적 실행 경계 점검 |
| .github/workflows/ui-r04q-offline-metadata-bridge.yml | 기존 Java 오프라인 계약 테스트에 추가 |
| build.gradle / gradle.lockfile | net.java.dev.jna:jna-platform:5.19.1 및 JNA 5.19.1 잠금 |

## 3. 저장소·비밀정보 보호 경계

- 테스트 경로는 java.io.tmpdir 하위 youtopia-r04u-synthetic-{UUID}/metadata-synthetic.dpapi **정해진 고정 형태**만 허용한다. 사용자가 지정한 임의 위치, 심볼릭 링크, non-Windows 실행은 거부한다.
- 바이트 배열이 R04U_SYNTHETIC_{UUID} 형식으로 시작하고 정확한 길이를 가질 때만 암호화한다. API 키처럼 생긴 값이나 실제 외부 비밀은 저장할 수 없도록 한다. **운영용 저장소가 아니다.**
- Java 직접 Crypt32Util 사용. CRYPTPROTECT_UI_FORBIDDEN을 사용하며 CRYPTPROTECT_LOCAL_MACHINE 플래그를 사용하지 않는다. CurrentUser DPAPI는 동일 사용자·PC 프로필에서의 복원에 의존한다.
- 디렉터리와 파일에 소유자에 대한 ACL을 적용하고, 다른 주체의 ALLOW 권한은 거부한다. 실제 Windows 관리자는 해당 계정의 비밀을 통제할 수 있으며 OS와 계정의 보안 모델에 종속된다.
- 임시 암호문 파일을 CREATE_NEW로 생성하고 파일 내용을 flush한 다음 ATOMIC_MOVE/REPLACE_EXISTING으로 회전한다. 이동 실패 시 기존 암호문을 덮어쓰지 않는다. 임시 파일은 finally에서 제거한다.
- 파일에는 MAGIC·길이·암호문만 저장한다. 최대 4KiB. 파손·길이 오류·DPAPI 무결성 불일치 시 반환하지 않고 실패한다.
- 복호화 바이트 배열은 callback의 실행 중에만 유효하며 finally에서 덮어쓴다. 하지만 Java GC/native 임시 복사본까지 완벽히 제로화한다고 주장하지 않는다. caller의 원본 배열도 별도 초기화가 필요하다.
- Delete는 암호문 파일 제거이지 SSD에서의 완전 삭제나 DPAPI 마스터키·복사본 폐기를 뜻하지 않는다.
- Java는 PowerShell stdout/subprocess로 비밀값을 전달받지 않는다. 네트워크·환경변수·Spring Bean·Controller·API 키 등록 경로·Cloud 연결과 완전히 분리된다.

공식 참고:
- https://learn.microsoft.com/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata
- https://learn.microsoft.com/windows/win32/api/dpapi/nf-dpapi-cryptunprotectdata
- https://github.com/java-native-access/jna/blob/master/contrib/platform/src/com/sun/jna/platform/win32/Crypt32Util.java
- https://central.sonatype.com/artifact/net.java.dev.jna/jna-platform/versions

## 4. 자동 및 Windows 로컬 QA 인수 조건

1. Java 21/JNA locked dependency 빌드 PASS.
2. Windows-latest에서 진짜 native DPAPI 암호화·복호화·다시 열기·회전·삭제·ACL·손상 거부 검증.
3. 암호문 파일에는 합성 평문이 포함되지 않으며 callback 후 민감 배열이 초기화된다.
4. JUnit에서 비합성 값, 잘못된 루트, 스코프 위반과 non-Windows 실행은 실패한다.
5. 기존 R04-T DPAPI PowerShell CI, Java 백엔드 보안, 관리자 권한, 격리 DB/Redis CI가 회귀 없이 통과한다.
6. 사용자 PC의 수동 QA는 GitHub Windows runner의 CI PASS와 별개다. 같은 commit의 별도 worktree에서 Java 테스트 성공을 사용자가 보고한 후에만 수동 QA PASS를 기록한다.

## 5. 실제 비밀키 사용은 별도 검수 및 승인

이번 Java 코어는 합성 전용이며, 운영 API 키를 받지 않고 서비스에 연결되지 않는다. 향후 별도 PR에서 실제 Windows 실행 주체와 파일 ACL, 운영용 LOCALAPPDATA 저장경로, 비밀 입력 UI·프로비저닝, 키 회전/유출 복구, 안전한 Java 메모리 경계, 실제 프로세스 외부 IP, Quota 원장, 메타데이터 전용 정책과 제공자 출처, 데이터 캐시·삭제까지 검수한다.

최초 실제 영상 metadata videos.list 단 한 번의 요청은 정확한 대상 VIDEO ID/실행자/시각/요청 1회·quota 1 unit·재시도0·중단 정책과 함께 사용자가 **별도 명시 승인**해야 한다. 댓글·감성 G45 게이트 해제, 병합, 배포 모두 별도 승인 대상.

현재 판정: JAVA_NATIVE_DPAPI_SYNTHETIC_CODE_WRITTEN / OPERATIONAL_CREDENTIAL_DISABLED / LIVE_YOUTUBE_0 / PR_DRAFT.
