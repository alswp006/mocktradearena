// 앱 전역 상태 — 계좌·보유종목·거래내역·스트릭·메타를 한 곳에서 들고,
// 모든 쓰기는 src/lib/storage.ts 래퍼를 경유한다(localStorage 직접 접근 금지).
//
// 마운트 시 일일 가상자금 지급 + 출석 스트릭 판정을 정확히 1회만 실행한다
// (StrictMode 이중 마운트 대비 ref 가드). 결과는 checkInResult로 노출하고,
// Toast/BottomSheet 같은 표시는 홈 화면이 담당한다.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Account, PositionMap, StreakState, Trade } from "@/lib/types";
import {
  loadAccount,
  loadMeta,
  loadPositions,
  loadStreak,
  loadTrades,
  saveAccount,
  saveMeta,
  savePositions,
  saveStreak,
  saveTrades,
} from "@/lib/storage";
import { addDaysKST, todayKst } from "@/lib/date";
import { getClose } from "@/lib/priceEngine";
import { getInstrument } from "@/data/instruments";

type StoredMeta = ReturnType<typeof loadMeta>;

/** 일일 지급·스트릭 판정 결과. 지급이 없었으면 granted/bonus는 0이다. */
export interface CheckInResult {
  /** 이번 진입에서 새로 지급됐는지 */
  granted: boolean;
  /** 지급된 일일 가상자금(원) */
  grantAmount: number;
  /** 지급된 스트릭 보너스(원) */
  bonusAmount: number;
  /** 판정 후 연속 출석일 */
  streakDays: number;
}

export interface TradeOutcome {
  ok: boolean;
  /** 실패 사유 — 화면은 이 문구를 필드 하단에 그대로 노출한다. */
  error?: string;
  trade?: Trade;
}

export interface AppStateValue {
  account: Account;
  positions: PositionMap;
  trades: Trade[];
  streak: StreakState;
  meta: StoredMeta;
  checkInResult: CheckInResult | null;
  /** 저장소에서 전체 상태를 다시 읽는다. */
  refresh: () => void;
  buy: (symbol: string, qty: number) => TradeOutcome;
  sell: (symbol: string, qty: number) => TradeOutcome;
  setDisclaimerSeen: () => void;
  unlockReport: (presetId: string) => void;
  /** 현금 + 보유종목 평가액 (원) */
  totalAsset: number;
}

const DAILY_GRANT = 1_000_000;
const MAX_UNLOCKED_REPORTS = 20;
const BUY_FEE_RATE = 0.00015;
const SELL_TAX_RATE = 0.0018;

const AppStateContext = createContext<AppStateValue | null>(null);

function ymdKst(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// @AI:NOTE 스트릭 보너스는 spec F2 기준 고정 계단이다(7일 50만 / 5일 30만 / 3일 10만).
function streakBonus(streakDays: number): number {
  if (streakDays >= 7) return 500_000;
  if (streakDays >= 5) return 300_000;
  if (streakDays >= 3) return 100_000;
  return 0;
}

function buyFee(qty: number, price: number): number {
  return Math.floor(qty * price * BUY_FEE_RATE);
}

function sellFee(qty: number, price: number): number {
  return Math.floor(qty * price * BUY_FEE_RATE) + Math.floor(qty * price * SELL_TAX_RATE);
}

function newTradeId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 현재가 조회 — 가격 엔진이 실패해도 화면이 죽지 않도록 0으로 degrade. */
function currentPrice(symbol: string): number {
  try {
    return getClose(symbol, todayKst());
  } catch {
    return 0;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>(() => loadAccount());
  const [positions, setPositions] = useState<PositionMap>(() => loadPositions());
  const [trades, setTrades] = useState<Trade[]>(() => loadTrades());
  const [streak, setStreak] = useState<StreakState>(() => loadStreak());
  const [meta, setMeta] = useState<StoredMeta>(() => loadMeta());
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);

  // StrictMode는 effect를 두 번 실행한다 — 지급이 두 번 반영되지 않게 ref로 잠근다.
  const checkedInRef = useRef(false);

  useEffect(() => {
    if (checkedInRef.current) return;
    checkedInRef.current = true;

    const today = todayKst();
    const currentAccount = loadAccount();
    const currentStreak = loadStreak();
    const lastGrantDay = ymdKst(currentAccount.lastGrantDate);

    // 같은 날 재진입이거나 기기 시계가 되돌아간 경우 → 지급 없음.
    if (lastGrantDay >= today) {
      setCheckInResult({
        granted: false,
        grantAmount: 0,
        bonusAmount: 0,
        streakDays: currentStreak.currentStreak,
      });
      return;
    }

    const continued = currentStreak.lastCheckInDate === addDaysKST(today, -1);
    const streakDays = continued ? currentStreak.currentStreak + 1 : 1;
    const bonus = streakBonus(streakDays);

    const nextAccount: Account = {
      ...currentAccount,
      cash: currentAccount.cash + DAILY_GRANT + bonus,
      lastGrantDate: new Date(),
      totalGranted: currentAccount.totalGranted + DAILY_GRANT + bonus,
    };
    const nextStreak: StreakState = {
      currentStreak: streakDays,
      longestStreak: Math.max(currentStreak.longestStreak, streakDays),
      lastCheckInDate: today,
      totalBonus: currentStreak.totalBonus + bonus,
    };

    saveAccount(nextAccount);
    saveStreak(nextStreak);
    setAccount(nextAccount);
    setStreak(nextStreak);
    setCheckInResult({
      granted: true,
      grantAmount: DAILY_GRANT,
      bonusAmount: bonus,
      streakDays,
    });
  }, []);

  const refresh = useCallback(() => {
    setAccount(loadAccount());
    setPositions(loadPositions());
    setTrades(loadTrades());
    setStreak(loadStreak());
    setMeta(loadMeta());
  }, []);

  const buy = useCallback((symbol: string, qty: number): TradeOutcome => {
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: "수량을 1주 이상 입력해주세요" };
    }
    const instrument = getInstrument(symbol);
    if (!instrument) return { ok: false, error: "종목 정보를 찾지 못했어요" };

    const price = currentPrice(symbol);
    const amount = qty * price;
    const fee = buyFee(qty, price);
    const currentAccount = loadAccount();
    if (currentAccount.cash < amount + fee) {
      return { ok: false, error: "잔액이 부족해요" };
    }

    const currentPositions = loadPositions();
    const held = currentPositions[symbol];
    const nextQty = (held?.qty ?? 0) + qty;
    const nextAvg = held
      ? Math.floor((held.qty * held.avgPrice + amount) / nextQty)
      : price;

    const trade: Trade = {
      id: newTradeId(),
      symbol,
      name: instrument.name,
      side: "BUY",
      qty,
      price,
      fee,
      amount,
      tradedAt: new Date(),
    };

    const nextAccount: Account = { ...currentAccount, cash: currentAccount.cash - amount - fee };
    const nextPositions: PositionMap = {
      ...currentPositions,
      [symbol]: { symbol, qty: nextQty, avgPrice: nextAvg },
    };
    const nextTrades = [...loadTrades(), trade];

    saveAccount(nextAccount);
    savePositions(nextPositions);
    saveTrades(nextTrades);
    setAccount(nextAccount);
    setPositions(nextPositions);
    setTrades(nextTrades);

    return { ok: true, trade };
  }, []);

  const sell = useCallback((symbol: string, qty: number): TradeOutcome => {
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: "수량을 1주 이상 입력해주세요" };
    }
    const instrument = getInstrument(symbol);
    if (!instrument) return { ok: false, error: "종목 정보를 찾지 못했어요" };

    const currentPositions = loadPositions();
    const held = currentPositions[symbol];
    if (!held || held.qty < qty) {
      return { ok: false, error: `보유 수량은 ${held?.qty ?? 0}주예요` };
    }

    const price = currentPrice(symbol);
    const amount = qty * price;
    const fee = sellFee(qty, price);
    const currentAccount = loadAccount();

    const trade: Trade = {
      id: newTradeId(),
      symbol,
      name: instrument.name,
      side: "SELL",
      qty,
      price,
      fee,
      amount,
      tradedAt: new Date(),
    };

    const nextAccount: Account = { ...currentAccount, cash: currentAccount.cash + amount - fee };
    const nextPositions: PositionMap = { ...currentPositions };
    if (held.qty === qty) {
      delete nextPositions[symbol];
    } else {
      nextPositions[symbol] = { ...held, qty: held.qty - qty };
    }
    const nextTrades = [...loadTrades(), trade];

    saveAccount(nextAccount);
    savePositions(nextPositions);
    saveTrades(nextTrades);
    setAccount(nextAccount);
    setPositions(nextPositions);
    setTrades(nextTrades);

    return { ok: true, trade };
  }, []);

  const setDisclaimerSeen = useCallback(() => {
    const next = { ...loadMeta(), disclaimerSeen: true, lastUpdated: new Date() };
    saveMeta(next);
    setMeta(next);
  }, []);

  const unlockReport = useCallback((presetId: string) => {
    const current = loadMeta();
    const ids = current.rewardUnlockedPresetIds ?? [];
    if (ids.includes(presetId)) return;
    const merged = [...ids, presetId].slice(-MAX_UNLOCKED_REPORTS);
    const next = { ...current, rewardUnlockedPresetIds: merged, lastUpdated: new Date() };
    saveMeta(next);
    setMeta(next);
  }, []);

  const totalAsset = useMemo(() => {
    return Object.values(positions).reduce(
      (sum, p) => sum + p.qty * currentPrice(p.symbol),
      account.cash,
    );
  }, [positions, account.cash]);

  const value = useMemo<AppStateValue>(
    () => ({
      account,
      positions,
      trades,
      streak,
      meta,
      checkInResult,
      refresh,
      buy,
      sell,
      setDisclaimerSeen,
      unlockReport,
      totalAsset,
    }),
    [
      account,
      positions,
      trades,
      streak,
      meta,
      checkInResult,
      refresh,
      buy,
      sell,
      setDisclaimerSeen,
      unlockReport,
      totalAsset,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (value === null) {
    throw new Error("useAppState는 AppStateProvider 안에서만 쓸 수 있어요 (App.tsx 확인)");
  }
  return value;
}
