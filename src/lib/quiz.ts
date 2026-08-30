// 투자성향 판정 — 룰 기반(생성형 AI 미사용). 점수 8~32점을 3단계 성향으로 나눈다.

import type { RiskType } from "@/lib/types";

/** 8문항 × 1~4점 합계(8~32)를 성향으로 변환한다. */
export function riskProfileOf(score: number): RiskType {
  if (score <= 16) return "conservative";
  if (score <= 24) return "moderate";
  return "aggressive";
}

export const RISK_LABEL: Record<RiskType, string> = {
  conservative: "안정형",
  moderate: "위험중립형",
  aggressive: "공격투자형",
};

export const RISK_DESCRIPTION: Record<RiskType, string> = {
  conservative: "원금을 지키는 쪽이 마음 편한 성향이에요",
  moderate: "수익과 안정 사이에서 균형을 찾는 성향이에요",
  aggressive: "변동을 감수하고 수익을 노리는 성향이에요",
};

/** 성향별 추천 종목 3개 — 고정 매핑. */
export const RECOMMENDED_SYMBOLS: Record<RiskType, string[]> = {
  conservative: ["069500", "102110", "105560"],
  moderate: ["005930", "069500", "133690"],
  aggressive: ["000660", "006400", "133690"],
};
