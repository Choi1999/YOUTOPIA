
import type { AnalysisTarget } from "../../analysis-target/analysisTarget";
import type { AnalysisSnapshot } from "../model/analysisSnapshot";

/**
 * FOUND: 사용할 분석 스냅샷이 존재한다.
 * NOT_FOUND: 아직 저장된 분석 스냅샷이 없다.
 *
 * NOT_FOUND는 분석을 완료했지만 유효한 댓글이 없는
 * AnalysisSnapshot.status = "NO_DATA"와 다르다.
 */
export type AnalysisLookupResult =
  | Readonly<{
      kind: "FOUND";
      snapshot: AnalysisSnapshot;
    }>
  | Readonly<{
      kind: "NOT_FOUND";
    }>;

/**
 * 분석 결과 조회를 위한 공통 데이터 접근 인터페이스.
 *
 * 호출자는 데이터가 데모에서 왔는지,
 * 실제 백엔드에서 왔는지 알 필요가 없다.
 */
export interface AnalysisRepository {
  getSnapshot(
    target: AnalysisTarget
  ): Promise<AnalysisLookupResult>;
}
