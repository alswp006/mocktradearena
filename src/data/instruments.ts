import type { Instrument } from "@/lib/types";

// 정적 종목 마스터 — 주식 10 + ETF 10, 총 20개. localStorage/네트워크 접근 없음.
export const INSTRUMENTS: Instrument[] = [
  // ── STOCK (10) ──────────────────────────────────────────────
  { symbol: "005930", name: "삼성전자", type: "STOCK", sector: "전기전자", basePrice: 71000, annualDrift: 0.08, annualVol: 0.25 },
  { symbol: "000660", name: "SK하이닉스", type: "STOCK", sector: "반도체", basePrice: 150000, annualDrift: 0.1, annualVol: 0.35 },
  { symbol: "207940", name: "삼성바이오로직스", type: "STOCK", sector: "바이오", basePrice: 780000, annualDrift: 0.09, annualVol: 0.3 },
  { symbol: "005380", name: "현대차", type: "STOCK", sector: "자동차", basePrice: 190000, annualDrift: 0.06, annualVol: 0.28 },
  { symbol: "035420", name: "NAVER", type: "STOCK", sector: "IT서비스", basePrice: 210000, annualDrift: 0.05, annualVol: 0.32 },
  { symbol: "035720", name: "카카오", type: "STOCK", sector: "IT서비스", basePrice: 42000, annualDrift: 0.02, annualVol: 0.4 },
  { symbol: "051910", name: "LG화학", type: "STOCK", sector: "화학", basePrice: 380000, annualDrift: 0.04, annualVol: 0.3 },
  { symbol: "006400", name: "삼성SDI", type: "STOCK", sector: "2차전지", basePrice: 350000, annualDrift: 0.07, annualVol: 0.38 },
  { symbol: "105560", name: "KB금융", type: "STOCK", sector: "금융", basePrice: 68000, annualDrift: 0.06, annualVol: 0.22 },
  { symbol: "055550", name: "신한지주", type: "STOCK", sector: "금융", basePrice: 45000, annualDrift: 0.05, annualVol: 0.2 },

  // ── ETF (10) ────────────────────────────────────────────────
  { symbol: "069500", name: "KODEX 200", type: "ETF", sector: "국내지수", basePrice: 34000, annualDrift: 0.06, annualVol: 0.18 },
  { symbol: "102110", name: "TIGER 200", type: "ETF", sector: "국내지수", basePrice: 34500, annualDrift: 0.06, annualVol: 0.18 },
  { symbol: "133690", name: "TIGER 미국나스닥100", type: "ETF", sector: "해외지수", basePrice: 105000, annualDrift: 0.11, annualVol: 0.22 },
  { symbol: "360750", name: "TIGER 미국S&P500", type: "ETF", sector: "해외지수", basePrice: 18500, annualDrift: 0.1, annualVol: 0.18 },
  { symbol: "379800", name: "KODEX 미국S&P500", type: "ETF", sector: "해외지수", basePrice: 18000, annualDrift: 0.1, annualVol: 0.18 },
  { symbol: "229200", name: "KODEX 코스닥150", type: "ETF", sector: "국내지수", basePrice: 12000, annualDrift: 0.03, annualVol: 0.3 },
  { symbol: "132030", name: "KODEX 골드선물(H)", type: "ETF", sector: "원자재", basePrice: 15500, annualDrift: 0.03, annualVol: 0.15 },
  { symbol: "130680", name: "TIGER 원유선물Enhanced(H)", type: "ETF", sector: "원자재", basePrice: 5200, annualDrift: -0.02, annualVol: 0.45 },
  { symbol: "114260", name: "KODEX 국고채3년", type: "ETF", sector: "채권", basePrice: 58000, annualDrift: 0.02, annualVol: 0.05 },
  { symbol: "279530", name: "KODEX 단기채권PLUS", type: "ETF", sector: "채권", basePrice: 102000, annualDrift: 0.02, annualVol: 0.05 },
];

// O(1) symbol → Instrument 조회
export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((instrument) => [instrument.symbol, instrument])
);

export function getInstrument(symbol: string): Instrument | undefined {
  return INSTRUMENT_MAP[symbol];
}
