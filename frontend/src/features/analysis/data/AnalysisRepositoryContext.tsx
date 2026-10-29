
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { AnalysisRepository } from "./AnalysisRepository";

/**
 * 분석 데이터 공급자를 React 컴포넌트에 제공한다.
 *
 * 화면은 Demo와 실제 API 중 어떤 공급자가 사용되는지
 * 알 필요가 없다.
 */
const AnalysisRepositoryContext =
  createContext<AnalysisRepository | null>(null);

export function AnalysisRepositoryProvider({
  repository,
  children,
}: {
  repository: AnalysisRepository;
  children: ReactNode;
}) {
  return (
    <AnalysisRepositoryContext.Provider value={repository}>
      {children}
    </AnalysisRepositoryContext.Provider>
  );
}

/**
 * 현재 연결된 분석 데이터 공급자를 반환한다.
 * Provider 외부에서 호출하면 구성 오류를 발생시킨다.
 */
export function useAnalysisRepository(): AnalysisRepository {
  const repository = useContext(AnalysisRepositoryContext);

  if (!repository) {
    throw new Error(
      "useAnalysisRepository must be used within AnalysisRepositoryProvider"
    );
  }

  return repository;
}
