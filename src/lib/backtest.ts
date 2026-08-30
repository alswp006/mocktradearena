/**
 * Packet 0007: 백테스트 계산 엔진 (시계열·CAGR·MDD·샤프)
 *
 * 초기 1,000만원 매수 후 보유 기준 월말 평가금액 시계열을 생성하고,
 * 총수익률·CAGR·MDD·샤프지수·연환산 변동성·연도별 수익률을 계산한다.
 *
 * 입력: BacktestPreset (프리셋 id, name, items[], years)
 * 출력: BacktestResult | {ok:false, reason:string}
 *
 * 가정:
 * - 배당 미반영
 * - 거래비용 미반영
 * - 리밸런싱 미반영
 * - 무위험수익률 연 3.0% 고정
 */

import type { BacktestPreset, BacktestResult } from "@/lib/types";

export type BacktestCalcResult = BacktestResult | { ok: false; reason: string };

/**
 * 백테스트 계산 엔진
 * 프리셋을 입력받아 검증한 후, 유효하면 BacktestResult를 반환.
 * 검증 실패 시 {ok:false, reason}을 반환 (throw하지 않음).
 */
export function runBacktest(preset: BacktestPreset): BacktestCalcResult {
  // TODO: AC1 ~ AC5 구현
  throw new Error("Not yet implemented");
}
