// Domain types — SPEC Data Models + RouteState navigation contract.
// Pure type declarations only (no runtime exports) — see .ai-factory/spec.md "Data Models".

// ── Instrument (정적 번들 데이터) ─────────────────────────────
export type InstrumentType = "STOCK" | "ETF";

export interface Instrument {
  symbol: string;
  name: string;
  type: InstrumentType;
  sector: string;
  basePrice: number;
  annualDrift: number;
  annualVol: number;
}

// ── PricePoint (메모리 캐시 전용) ─────────────────────────────
export interface PricePoint {
  date: string; // "YYYY-MM-DD"
  close: number;
}

// ── Account ───────────────────────────────────────────────────
export interface Account {
  cash: number;
  lastGrantDate: Date;
  totalGranted: number;
  createdAt: Date;
}

// ── Position ──────────────────────────────────────────────────
export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export type PositionMap = Record<string, Position>;

// ── Trade ─────────────────────────────────────────────────────
export type TradeSide = "BUY" | "SELL";

export interface Trade {
  id: string;
  symbol: string;
  name: string;
  side: TradeSide;
  qty: number;
  price: number;
  fee: number;
  amount: number;
  tradedAt: Date;
}

// ── StreakState ───────────────────────────────────────────────
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string; // "YYYY-MM-DD"
  totalBonus: number;
}

// ── Risk profile (BacktestPreset/BacktestResult/QuizResult 공유) ─
export type RiskType = "conservative" | "moderate" | "aggressive";

// ── BacktestPreset ────────────────────────────────────────────
export interface PresetItem {
  symbol: string;
  weight: number; // 정수 퍼센트, 5 ~ 100
}

export type BacktestYears = 1 | 3 | 5 | 10;

export interface BacktestPreset {
  id: string;
  name: string;
  items: PresetItem[]; // 1~5개, weight 합계 === 100
  years: BacktestYears;
  createdAt: string; // ISO8601
}

// ── BacktestResult ────────────────────────────────────────────
export interface YearlyReturn {
  year: number;
  returnPct: number;
}

export interface BacktestResult {
  presetId: string;
  years: BacktestYears;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  initialAmount: 10000000; // 고정 1,000만원
  finalAmount: number; // 원
  totalReturnPct: number; // 소수 2자리
  cagrPct: number; // 소수 2자리
  mddPct: number; // 음수, 소수 2자리
  sharpe: number; // 소수 2자리
  volatilityPct: number; // 연환산 변동성, 소수 2자리
  monthlyEquity: number[]; // 월말 평가금액 시계열 (years*12+1 개)
  yearly: YearlyReturn[];
  computedAt: string; // ISO8601
}

// ── QuizResult ────────────────────────────────────────────────
export interface QuizResult {
  id: string;
  userId: string;
  answers: number[];
  score: number;
  riskProfile: RiskType;
  createdAt: Date;
}

// ── LeaderboardEntry ──────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  backtestCount: number;
  bestReturn: number;
  createdAt: Date;
}

// ── AppMeta ───────────────────────────────────────────────────
export interface AppMeta {
  version: string;
  lastUpdated: Date;
  dataVersion: string;
}

// ── RouteState (navigate state 계약, 9개 라우트) ────────────────
export type RouteState = {
  "/": Record<string, never>;
  "/market": { from?: "portfolio" };
  "/trade/:symbol": { symbol: string; from?: "market" | "portfolio" };
  "/portfolio": { justTradedSymbol?: string };
  "/backtest": { presetId?: string };
  "/backtest/result": {
    resultId?: string;
    presetId?: string;
    years?: BacktestYears;
  };
  "/quiz": Record<string, never>;
  "/quiz/result": { quizResultId?: string; score?: number; type?: RiskType };
  "/leaderboard": Record<string, never>;
};

// Runtime module marker — enables Object.keys() detection while keeping pure type declarations
export enum _TypeModule {}
