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
  description: string;
  symbols: string[];
  startCapital: number;
  years: BacktestYears;
  riskType: RiskType;
  createdAt: Date;
  updatedAt: Date;
}

// ── BacktestResult ────────────────────────────────────────────
export interface YearlyReturn {
  year: number;
  return: number;
}

export interface BacktestResult {
  id: string;
  presetId: string;
  years: BacktestYears;
  startCapital: number;
  endCapital: number;
  trades: Trade[];
  returns: YearlyReturn[];
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  riskType: RiskType;
  createdAt: Date;
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
