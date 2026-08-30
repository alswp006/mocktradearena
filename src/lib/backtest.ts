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

import type { BacktestPreset, BacktestResult, YearlyReturn } from "@/lib/types";
import { getClose } from "@/lib/priceEngine";
import { todayKst, addYears, endOfMonth, getKSTDate } from "@/lib/date";

export type BacktestCalcResult = BacktestResult | { ok: false; reason: string };

const RISK_FREE_RATE = 0.03; // 연 3.0% 고정
const INITIAL_AMOUNT = 10000000; // 1,000만원 고정

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// startDate 기준 months개월 뒤 달의 1일 ("YYYY-MM-01")
function addMonths(dateStr: string, months: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}-01`;
}

/**
 * 백테스트 계산 엔진
 * 프리셋을 입력받아 검증한 후, 유효하면 BacktestResult를 반환.
 * 검증 실패 시 {ok:false, reason}을 반환 (throw하지 않음).
 * 배당·거래비용·리밸런싱 미반영, 무위험수익률 연 3.0% 고정.
 */
export function runBacktest(preset: BacktestPreset): BacktestCalcResult {
  const items = preset.items ?? [];
  if (items.length < 1 || items.length > 5) {
    return {
      ok: false,
      reason: `items 개수는 1~5개여야 합니다 (현재 ${items.length}개)`,
    };
  }
  const weightSum = items.reduce((sum, it) => sum + it.weight, 0);
  if (weightSum !== 100) {
    return {
      ok: false,
      reason: `weight 합계는 100이어야 합니다 (현재 ${weightSum})`,
    };
  }

  const years = preset.years;
  const months = years * 12;
  const endDateAnchor = todayKst();
  const startDate = addYears(endDateAnchor, -years);

  // 월말 평가일 목록: index 0은 매수일(startDate), 1..months는 순차 월말
  const monthDates: string[] = [startDate];
  for (let k = 1; k <= months; k++) {
    monthDates.push(endOfMonth(addMonths(startDate, k)));
  }

  // 매수일 종가로 종목별 보유 수량 산정 (매수 후 보유, 리밸런싱 없음)
  const shares = items.map((item) => {
    const price0 = getClose(item.symbol, startDate);
    const alloc = (INITIAL_AMOUNT * item.weight) / 100;
    return price0 > 0 ? alloc / price0 : 0;
  });

  const equity: number[] = [INITIAL_AMOUNT];
  for (let k = 1; k <= months; k++) {
    const date = monthDates[k];
    let value = 0;
    for (let i = 0; i < items.length; i++) {
      value += shares[i] * getClose(items[i].symbol, date);
    }
    equity.push(Math.round(value));
  }

  const finalAmount = equity[equity.length - 1];

  const totalReturnPct = round2(
    ((finalAmount - INITIAL_AMOUNT) / INITIAL_AMOUNT) * 100,
  );
  const cagrPct = round2(
    (Math.pow(finalAmount / INITIAL_AMOUNT, 1 / years) - 1) * 100,
  );

  // MDD: 시계열 상 최고점 대비 최대 낙폭
  let peak = equity[0];
  let maxDrawdown = 0;
  for (const value of equity) {
    if (value > peak) peak = value;
    const drawdown = peak > 0 ? (value - peak) / peak : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  const mddPct = round2(maxDrawdown * 100);

  // 월간 수익률 → 연환산 변동성
  const monthlyReturns: number[] = [];
  for (let k = 1; k < equity.length; k++) {
    const prev = equity[k - 1];
    monthlyReturns.push(prev > 0 ? equity[k] / prev - 1 : 0);
  }
  const meanReturn =
    monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
  const variance =
    monthlyReturns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) /
    monthlyReturns.length;
  const monthlyStd = Math.sqrt(variance);
  const volatilityPct = round2(monthlyStd * Math.sqrt(12) * 100);

  const annualizedReturn = cagrPct / 100;
  const annualizedVol = volatilityPct / 100;
  const sharpe =
    annualizedVol === 0
      ? 0
      : round2((annualizedReturn - RISK_FREE_RATE) / annualizedVol);

  // 연도별 수익률: (year)*12 ~ (year+1)*12 구간
  const yearly: YearlyReturn[] = [];
  for (let y = 0; y < years; y++) {
    const startIdx = y * 12;
    const endIdx = (y + 1) * 12;
    const startValue = equity[startIdx];
    const endValue = equity[endIdx];
    const returnPct = round2(
      startValue > 0 ? (endValue / startValue - 1) * 100 : 0,
    );
    yearly.push({ year: y + 1, returnPct });
  }

  return {
    presetId: preset.id,
    years,
    startDate,
    endDate: monthDates[months],
    initialAmount: 10000000,
    finalAmount,
    totalReturnPct,
    cagrPct,
    mddPct,
    sharpe,
    volatilityPct,
    monthlyEquity: equity,
    yearly,
    computedAt: getKSTDate(),
  };
}
