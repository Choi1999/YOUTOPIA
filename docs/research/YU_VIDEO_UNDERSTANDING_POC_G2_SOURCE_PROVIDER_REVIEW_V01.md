# YOUTOPIA — 영상 이해 PoC G2 소스·모델 제공자 적격성 검토 v0.1

> 작성·공개문서 확인일: **2026-11-05 (KST)**  
> 브랜치: `experiment/yu-video-understanding-poc-v01`  
> 기준: G1 `b0cfa98ee0cc827c187a07dc3e83a1607edf6884`  
> 상태: **G2_PUBLIC_DOC_REVIEW_COMPLETED / G2_SOURCE_ELIGIBILITY_BLOCKED / OFFLINE_ONLY / NO_LIVE_API / NO_MERGE**  
> 본 문서는 제공자 공개 문서 검토이며 실제 프로젝트 계정, 영상 권리, 과금 또는 최초 API 호출의 승인 증거가 아니다.

## 1. 결론과 구분해야 할 승인

- **기술 가능성:** Gemini API의 Video understanding 문서는 **공개 YouTube URL을 영상 입력으로 전달하는 기능(Preview)**을 명시한다. 기능 자체는 Preview 기간 추가 사용 요금 없음으로 표기되지만 **모델의 토큰 과금이 무료라고 해석하지 않는다**.
- **모델 후보:** `gemini-3.5-flash-lite`는 공식 모델 페이지상 영상 입력을 지원한다. 공개 가격표의 유료 Standard 기준 100만 토큰당 입력 **US$0.30**(텍스트·이미지·영상·오디오), 출력 **US$2.50**. 2026-11-05의 **문서상 가격 스냅샷**이다.
- **정책 제약:** YouTube API 개발자 정책은 사전 서면 승인 없는 시청각 콘텐츠의 다운로드·복사·캐시·저장을 제한한다. 공식 `captions.download`는 영상 수정 권한이 필요하다. 유튜브 공개 여부·API 문서에 기능이 있다는 사실은 YOUTOPIA 사업 목적 사용·프레임 저장·파생 콘텐츠 보관·제3자 분석 송신의 포괄적 허가와 다르다.
- **계정·데이터 적격성:** 유효한 프로젝트에서 해당 기능과 모델을 실행할 수 있는지, 대상 영상 6개를 모든 비교 경로에 합법적으로 제공할 수 있는지, 독립 검수자가 정답 타임코드를 승인했는지는 **모두 미확인**이다.
- **정책 결과:** G2의 **문헌조사만 완료**, 실제 소스 선정·사용권 확인·비교 데이터셋 구성은 **차단**. G3 실호출은 승인하지 않는다.

## 2. 공식 근거 원장 (2026-11-05 확인)

| ID | 공식 문서 | 근거로 확인한 사실 | 범위·한계 |
|---|---|---|---|
| G2-E01 | [Gemini Video Understanding](https://ai.google.dev/gemini-api/docs/video-understanding) | 공개 YouTube URL을 영상 입력으로 받는 Preview 기능; 비공개/일부공개 제외 | 서비스 사용 권한·계정 활성·모델 청구 검증 아님 |
| G2-E02 | [Gemini 3.5 Flash-Lite 모델](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) | 영상·음성·이미지·텍스트 입력, 텍스트 출력 | 특정 프로젝트에서 실행 성공 검증 아님 |
| G2-E03 | [Gemini 요금표](https://ai.google.dev/gemini-api/docs/pricing) | Flash-Lite 유료 Standard 입력 $0.30/100만 토큰, 출력 $2.50/100만 토큰 | 계정별 과금, Agentic 처리 토큰 수, 부가 비용 미검증 |
| G2-E04 | [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies) | 시청각 콘텐츠 다운로드·캐시·저장 등 제한 | 권리자 원본 영상의 독립 사용권과 YouTube 서비스 이용 규정은 별도로 검토 |
| G2-E05 | [YouTube captions.download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) | 영상 수정 권한 필요, 단순 공개 자막에 대한 범용 API 아님 | 직접 다운로드 절차 사용 금지, 사용 가능한 영상 소유자 권한도 미검증 |
| G2-E06 | [Gemini URL context](https://ai.google.dev/gemini-api/docs/url-context) | 일반 URL context 도구에서는 YouTube 영상을 처리하지 못하며 영상 이해 입력과 구별 | 두 기능 혼용 금지 |

위의 공식 문서는 언제든 개정될 수 있다. 실제 G3 실행 직전 **모델 ID·영상 URL 지원 방식·용량/일일 한도·요금·약관**을 다시 확인해야 한다. 현재 Video understanding 문서는 무료 티어 YouTube 영상 입력 **하루 8시간** 제한, 유료 티어는 영상 길이에 기초한 별도 제한 없음, 비공개/일부공개 영상은 미지원이라고 기술한다. 이는 **서비스 전체 쿼터 및 컨텍스트 크기 제한이 없다는 의미는 아니다.**

## 3. 세 실험군의 실제 입력 적격성 조건

| 경로 | 예정 입력 | G2 적격성에 필요한 증거 | 현재 |
|---|---|---|---|
| A. Native multimodal | Gemini의 공식 YouTube URL **영상 입력** | 공개로 접근 가능한 영상, 해당 모델/계정 사용 가능, 제공자 약관·권리·전송·보존 검수 | **지원 문서 확인, 실사용 미승인** |
| B. Semantic index | 허가된 원본 영상·음성·프레임 | 권리자가 정식 제공한 원본, 자산 사용권, 프레임/ASR/OCR/의미 인덱스 생성 및 삭제 정책 승인 | **미선정·미승인** |
| C. Transcript only | 허가된 영상의 대본/자막 | 권리자가 제공하거나 합법적으로 이용권을 확보한 정확한 대본 및 LLM 처리 허가, 출처·타임코드 | **미선정·미승인** |

같은 영상의 각 경로별 입력을 서로 다른 출처로 수집할 때는 **실제로 동일한 버전의 동일한 영상**인지 입증해야 한다. A의 공개 URL과 B·C의 원본/대본이 같은 개정본인지 확인하지 못하면, 세 경로의 품질·가격 우열을 직접 비교하지 않는다.

YouTube URL 기능은 **공급자가 문서화한 입력**을 사용하되 브라우저 우회 다운로드나 비공식 자막 추출을 정당화하는 수단으로 쓰지 않는다. 댓글 수집·감성분석의 기존 별도 정책 Gate는 계속 유지한다.

## 4. 실영상 6건 데이터셋 — 모두 아직 미선정

| G1 합성 슬롯 | 필요한 장르 | 실제 영상 선택 | 권리·보관·송신 승인 | 독립 골드 라벨 |
|---|---|---|---|---|
| SYNTH-VID-01 | 인터뷰/대화 | NOT_SELECTED | UNVERIFIED | NOT_STARTED |
| SYNTH-VID-02 | 인터뷰/대화 | NOT_SELECTED | UNVERIFIED | NOT_STARTED |
| SYNTH-VID-03 | 화면 시연/강의 | NOT_SELECTED | UNVERIFIED | NOT_STARTED |
| SYNTH-VID-04 | 화면 시연/강의 | NOT_SELECTED | UNVERIFIED | NOT_STARTED |
| SYNTH-VID-05 | 동작/게임 | NOT_SELECTED | UNVERIFIED | NOT_STARTED |
| SYNTH-VID-06 | 동작/실물 | NOT_SELECTED | UNVERIFIED | NOT_STARTED |

실제 후보 영상은 대화/공개 GitHub에 URL·인물정보·권리증빙·원문을 즉시 게시하지 않는다. 선정 후 권한 있는 별도 증거 보관소에 **소유자, 이용 범위(분석/제3자 송신/파생 인덱스/재사용), 원본과 공개본의 버전 정합성, 보존 기한, 철회/삭제 책임자, 개인정보 검토, 만료 및 검수자**를 분리 기록한다.

동영상 공개 여부는 저작권/사용 허가와 별도다. 제작자 제공 원본도 제3자 출연·음악·화면 내 개인정보 권한을 자동 해결하지 않는다.

## 5. 정답 데이터와 품질 비교의 필수 선행 조건

1. **36개 질문의 동일성**: 발화 사실 12, 시각 사건 8, OCR 6, 시간 순서 5, 답변 불가 5. 동일 영상의 동일 원본 버전에서 질문을 생성한다.
2. **시간코드 근거**: 시작/종료 밀리초, 근거 모달리티(발화·프레임·OCR), 화면 변화와 설명/해석 구분, 시간 순서(BEFORE/AFTER) 보존.
3. **인적 검수**: 질문·정답·인용 가능 범위를 **최소 2명**이 독립 라벨링 후 불일치를 해소. 정답은 모델 프롬프트에 제공하지 않는다.
4. **실험 공정성**: 동일 버전 영상과 동일 36개 질문을 A/B/C에 적용하고 누락/거절도 실패·부분 상태로 보존. B·C에만 추가 사전 정답 노출 금지.
5. **비용 재현성**: 모델/티어/토큰/해상도/동영상 처리방식/요금 확인일/도구·스토리지·전처리·재시도·재검증 비용을 기록한다.

독립 평가 인력이 섭외되거나 영상이 확보되었다는 근거는 아직 없다. G1의 합성 정답 36건은 실제 사람의 영상 라벨이 아니므로 대체할 수 없다.

## 6. 공개 요금 계산: 확인한 것과 모르는 것

`gemini-3.5-flash-lite` 표준 유료 요금 문서상의 **가상 토큰 사용량 예시**:
- 입력 **60,000 토큰** × $0.30/1M = **$0.0180**
- 출력 **1,000 토큰** × $2.50/1M = **$0.0025**
- 입력+출력 토큰 항목만 합계 **$0.0205**

**실제 영상 10분의 사용량이라고 단정할 수 없다.** 비디오/오디오의 처리 토큰, Agentic 방식, 전처리·인덱싱·보관·도구 및 과금 설정은 확인되지 않았다. 따라서 **엔드투엔드 비용은 null(미확인)**로 표기하며, 공개가격 표로 실제 청구금액 또는 운영 총비용이 확인되었다고 주장하지 않는다.

`g2-source-provider.cjs`는 이 계산의 **토큰 항목만** 평가한다. API 호출 가능 상태·실제 청구 검증·실영상 준비 상태로 승격하지 않으며, 누락된 토큰 수는 0원으로 처리하지 않는다.

## 7. 이번 구현 및 G2 게이트

추가 코드:
- `shared/experiments/yu-video-understanding-poc-v0/g2-source-provider.cjs`
- `shared/experiments/yu-video-understanding-poc-v0/tests/g2-eligibility.test.cjs`
- 기존 G1 오프라인 GitHub Actions의 G2 검수 단계 확장

G2 정적 검증기는 합성 영상 6개 슬롯의 **권리 미검증·영상 미선정** 상태만 허용한다. 영상 주소/실제 데이터/라이선스 확인값/사람 검수값/외부 호출이 입력되면 실패 폐쇄하여 실호출 상태를 조용히 활성화하지 못하게 한다.

실행:
```powershell
cd C:\Projects\YOUTOPIA
node --check shared/experiments/yu-video-understanding-poc-v0/g2-source-provider.cjs
node --test shared/experiments/yu-video-understanding-poc-v0/tests/*.test.cjs
node shared/experiments/yu-video-understanding-poc-v0/g2-source-provider.cjs
```

독립 QA: 원격 GitHub Actions 실행 ID·검증 커밋/결과를 확인해서 기록한다. 모든 모의 또는 정적 검증 결과는 **실제 API 기능·저작권 허가·실영상 정확도 검증을 의미하지 않는다**.

## 8. G2 미충족 증거 / 다음 승인

| 작업 | 상태 | 후속 필요 근거 |
|---|---|---|
| 제공자 API·요금 공식 문서 | OBSERVED / DOCUMENT_ONLY | G3 직전 재확인 |
| 대상 영상 6건의 권리자 동의·이용권 | UNVERIFIED | 실제 권리자/라이선스·전송·복제 허가 증빙 |
| A/B/C 동일 영상·대본·버전 | UNVERIFIED | 원본 해시·공개본 URL·대본 provenance 대조 |
| 36개 질문의 실제 인간 정답 검수 | NOT_STARTED | 최소 2명 독립 검수·조정 |
| 계정·청구·쿼터·보안 | UNVERIFIED | 해당 계정 설정의 독립 검토 |
| 데이터 수명주기와 철회 처리 | NOT_VERIFIED | 삭제·보존·캐시 정책 |
| G3 첫 실제 모델 API 호출 | NOT_APPROVED | 영상/모델/예산/실행자/횟수/폐기 계획에 대한 사용자 별도 승인 |

**G2 결과: 공식 문서 조사와 오프라인 적격성 검사 구축은 완료할 수 있으나, 영상 소스 적격성은 BLOCKED다. G3 실행은 절대 자동 허가되지 않는다.**

기존 [YOUTOPIA YouTube Source Readiness](../integration/YU32_G4_5_YOUTUBE_SOURCE_READINESS_V01.md)·[Provider Policy Evidence Matrix](../integration/YU32_G4_5_PROVIDER_POLICY_EVIDENCE_MATRIX_V01.md)·[G45-L8 First Call Gate](../integration/YU32_G45_L8_CLOUD_EVIDENCE_FIRST_CALL_GATE_V01.md)의 `POLICY_HOLD`를 변경하지 않는다.
