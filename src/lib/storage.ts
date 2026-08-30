// localStorage 안전 래퍼 — 모든 저장소 접근의 단일 게이트.
// 손상 JSON은 기본값으로 조용히 복구하고, QuotaExceededError는 mta:trades 오래된 100건을
// 삭제한 뒤 1회 재시도한다. 상위 계층은 이 파일의 load*/save*만 호출하고 localStorage에
// 직접 접근하지 않는다.

import type {
  Account,
  PositionMap,
  Trade,
  StreakState,
  BacktestPreset,
  BacktestResult,
  QuizResult,
  LeaderboardEntry,
  AppMeta,
} from "@/lib/types";

export const STORAGE_KEYS = {
  meta: "mta:meta",
  account: "mta:account",
  positions: "mta:positions",
  trades: "mta:trades",
  streak: "mta:streak",
  presets: "mta:presets",
  lastBacktest: "mta:lastBacktest",
  quiz: "mta:quiz",
  leaderboardSeed: "mta:leaderboardSeed",
} as const;

type QuotaExceededHandler = (message: string) => void;

const QUOTA_MESSAGE = "저장 공간이 부족해요. 거래내역을 정리해주세요";
const MAX_TRADES = 500;
const MAX_PRESETS = 10;
const TRADES_TRIM_ON_QUOTA = 100;

// ── 내부 유틸 ─────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T, revive?: (raw: T) => T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return revive ? revive(parsed) : parsed;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

function isQuotaExceeded(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "QuotaExceededError" || /QuotaExceeded/.test(err.message);
}

function trimOldestTrades(count: number): void {
  const raw = localStorage.getItem(STORAGE_KEYS.trades);
  if (!raw) return;
  try {
    const trades = JSON.parse(raw) as Trade[];
    localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(trades.slice(count)));
  } catch {
    localStorage.setItem(STORAGE_KEYS.trades, "[]");
  }
}

function safeWrite(key: string, value: unknown, onQuotaExceeded?: QuotaExceededHandler): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (!isQuotaExceeded(err)) return;
    trimOldestTrades(TRADES_TRIM_ON_QUOTA);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      onQuotaExceeded?.(QUOTA_MESSAGE);
    }
  }
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

function reviveTrade(t: Trade): Trade {
  return { ...t, tradedAt: toDate(t.tradedAt) };
}

// ── Account ───────────────────────────────────────────────────

function defaultAccount(): Account {
  return { cash: 1000000, lastGrantDate: new Date(), totalGranted: 1000000, createdAt: new Date() };
}

export function loadAccount(): Account {
  return safeRead(STORAGE_KEYS.account, defaultAccount(), (a) => ({
    ...a,
    lastGrantDate: toDate(a.lastGrantDate),
    createdAt: toDate(a.createdAt),
  }));
}

export function saveAccount(account: Account, onQuotaExceeded?: QuotaExceededHandler): void {
  safeWrite(STORAGE_KEYS.account, account, onQuotaExceeded);
}

// ── Positions ─────────────────────────────────────────────────

export function loadPositions(): PositionMap {
  return safeRead(STORAGE_KEYS.positions, {} as PositionMap);
}

export function savePositions(positions: PositionMap, onQuotaExceeded?: QuotaExceededHandler): void {
  safeWrite(STORAGE_KEYS.positions, positions, onQuotaExceeded);
}

// ── Trades ────────────────────────────────────────────────────

export function loadTrades(): Trade[] {
  return safeRead(STORAGE_KEYS.trades, [] as Trade[], (list) => list.map(reviveTrade));
}

export function saveTrades(trades: Trade[], onQuotaExceeded?: QuotaExceededHandler): void {
  const trimmed = trades.length > MAX_TRADES ? trades.slice(trades.length - MAX_TRADES) : trades;
  safeWrite(STORAGE_KEYS.trades, trimmed, onQuotaExceeded);
}

// ── Streak ────────────────────────────────────────────────────

function defaultStreak(): StreakState {
  return { currentStreak: 0, longestStreak: 0, lastCheckInDate: "", totalBonus: 0 };
}

export function loadStreak(): StreakState {
  return safeRead(STORAGE_KEYS.streak, defaultStreak());
}

export function saveStreak(streak: StreakState, onQuotaExceeded?: QuotaExceededHandler): void {
  safeWrite(STORAGE_KEYS.streak, streak, onQuotaExceeded);
}

// ── Presets ───────────────────────────────────────────────────

export function loadPresets(): BacktestPreset[] {
  return safeRead(STORAGE_KEYS.presets, [] as BacktestPreset[]);
}

export function savePresets(presets: BacktestPreset[], onQuotaExceeded?: QuotaExceededHandler): void {
  const trimmed = presets.length > MAX_PRESETS ? presets.slice(presets.length - MAX_PRESETS) : presets;
  safeWrite(STORAGE_KEYS.presets, trimmed, onQuotaExceeded);
}

// ── Last backtest result ─────────────────────────────────────

export function loadLastBacktest(): BacktestResult | null {
  return safeRead(STORAGE_KEYS.lastBacktest, null as BacktestResult | null);
}

export function saveLastBacktest(
  result: BacktestResult | null,
  onQuotaExceeded?: QuotaExceededHandler
): void {
  safeWrite(STORAGE_KEYS.lastBacktest, result, onQuotaExceeded);
}

// ── Quiz ──────────────────────────────────────────────────────

export function loadQuiz(): QuizResult | null {
  return safeRead(STORAGE_KEYS.quiz, null as QuizResult | null, (q) =>
    q ? { ...q, createdAt: toDate(q.createdAt) } : q
  );
}

export function saveQuiz(result: QuizResult | null, onQuotaExceeded?: QuotaExceededHandler): void {
  safeWrite(STORAGE_KEYS.quiz, result, onQuotaExceeded);
}

// ── Leaderboard seed ──────────────────────────────────────────

const BOT_NAME_POOL = [
  "불꽃개미", "가치투자러", "장기보유왕", "스윙마스터", "리밸런서",
  "배당사냥꾼", "익절요정", "존버클래식", "차트읽는사람", "리스크헤저",
  "물타기장인", "우량주러버", "국내파", "해외파", "분산투자자",
];

const DEFAULT_LEADERBOARD_SIZE = 49;

function defaultLeaderboardSeed(): LeaderboardEntry[] {
  return Array.from({ length: DEFAULT_LEADERBOARD_SIZE }, (_, i) => {
    const rank = i + 1;
    const cycle = Math.floor(i / BOT_NAME_POOL.length) + 1;
    const base = BOT_NAME_POOL[i % BOT_NAME_POOL.length];
    return {
      rank,
      userId: `bot-${String(rank).padStart(2, "0")}`,
      userName: cycle > 1 ? `${base}${cycle}` : base,
      score: Math.max(500000, 8000000 - i * 130000),
      backtestCount: Math.max(1, 30 - i),
      bestReturn: Math.max(-0.1, 0.6 - i * 0.012),
      createdAt: new Date(),
    };
  });
}

export function loadLeaderboardSeed(): LeaderboardEntry[] {
  return safeRead(STORAGE_KEYS.leaderboardSeed, defaultLeaderboardSeed(), (list) =>
    list.map((e) => ({ ...e, createdAt: toDate(e.createdAt) }))
  );
}

export function saveLeaderboardSeed(
  entries: LeaderboardEntry[],
  onQuotaExceeded?: QuotaExceededHandler
): void {
  safeWrite(STORAGE_KEYS.leaderboardSeed, entries, onQuotaExceeded);
}

// ── Meta ──────────────────────────────────────────────────────
// AppMeta(types.ts)는 version/lastUpdated/dataVersion만 선언하지만, 실제 SPEC 스키마는
// schemaVersion/disclaimerSeen/rewardUnlockedPresetIds도 요구한다. 공유 타입은 재정의하지
// 않고, 이 모듈 내부에서만 쓰는 교집합 타입으로 두 계약을 함께 만족시킨다.
type StoredAppMeta = AppMeta & {
  schemaVersion: number;
  disclaimerSeen: boolean;
  onboardedAt: string;
  rewardUnlockedPresetIds: string[];
};

function defaultMeta(): StoredAppMeta {
  return {
    version: "1",
    lastUpdated: new Date(),
    dataVersion: "1",
    schemaVersion: 1,
    disclaimerSeen: false,
    onboardedAt: new Date().toISOString(),
    rewardUnlockedPresetIds: [],
  };
}

export function loadMeta(): StoredAppMeta {
  return safeRead(STORAGE_KEYS.meta, defaultMeta(), (m) => ({
    ...m,
    lastUpdated: toDate(m.lastUpdated),
  }));
}

export function saveMeta(meta: AppMeta, onQuotaExceeded?: QuotaExceededHandler): void {
  safeWrite(STORAGE_KEYS.meta, meta, onQuotaExceeded);
}
