// 부트스트랩(최초 진입 초기화) + 일일 가상자금 지급/출석 스트릭 갱신 — 순수 로직.
// UI 없음, 결과 객체만 반환. 저장(localStorage)은 호출부(storage.ts)가 담당.

import { STORAGE_KEYS, loadAccount, loadStreak, saveAccount, saveStreak } from "@/lib/storage";
import { todayKst, addDaysKST } from "@/lib/date";
import type { Portfolio } from "@/lib/contract";

export interface BootstrapAccount {
  cash: number;
  lastGrantDate: string;
  totalGranted: number;
  createdAt: string;
}

export interface BootstrapMeta {
  schemaVersion: number;
  disclaimerSeen: boolean;
  onboardedAt: string;
  rewardUnlockedPresetIds: string[];
}

// bootstrap: 전달된 storage(Map 또는 Map 유사 어댑터)에 계정/메타가 없으면 기본값을 만들어 넣는다.
export function bootstrap(storage: Map<string, any>): { account: BootstrapAccount; meta: BootstrapMeta } {
  let account = storage.get(STORAGE_KEYS.account) as BootstrapAccount | undefined;
  if (!account) {
    const today = todayKst();
    account = { cash: 1000000, lastGrantDate: today, totalGranted: 1000000, createdAt: today };
    storage.set(STORAGE_KEYS.account, account);
  }

  let meta = storage.get(STORAGE_KEYS.meta) as BootstrapMeta | undefined;
  if (!meta) {
    meta = {
      schemaVersion: 1,
      disclaimerSeen: false,
      onboardedAt: todayKst(),
      rewardUnlockedPresetIds: [],
    };
    storage.set(STORAGE_KEYS.meta, meta);
  }

  return { account, meta };
}

export interface CheckinAccount {
  cash: number;
  lastGrantDate: string; // "YYYY-MM-DD"
  totalGranted: number;
  createdAt?: string;
}

export interface CheckinStreak {
  currentStreak: number;
  longestStreak: number;
  totalBonus?: number;
}

export interface DailyCheckInResult {
  granted: boolean;
  grantAmount: number;
  bonusAmount: number;
  streak: { currentStreak: number; longestStreak: number };
  isNewStreakMilestone: boolean;
}

const DAILY_GRANT = 1000000;

function bonusForStreak(streak: number): number {
  if (streak >= 7) return 500000;
  if (streak >= 5) return 300000;
  if (streak >= 3) return 100000;
  return 0;
}

// performDailyCheckin: account/streak를 in-place로 갱신하고 지급 결과를 반환한다.
// lastGrantDate는 "YYYY-MM-DD" 사전순 비교로 판정 — 시계 역행(미래 날짜)도 문자열 비교로 안전하게 거부된다.
export function performDailyCheckin(account: CheckinAccount, streak: CheckinStreak): DailyCheckInResult {
  const today = todayKst();

  if (account.lastGrantDate >= today) {
    return {
      granted: false,
      grantAmount: 0,
      bonusAmount: 0,
      streak: { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak },
      isNewStreakMilestone: false,
    };
  }

  const yesterday = addDaysKST(today, -1);
  const nextStreak = account.lastGrantDate === yesterday ? streak.currentStreak + 1 : 1;
  const nextLongest = Math.max(streak.longestStreak, nextStreak);
  const bonus = bonusForStreak(nextStreak);

  account.cash = Math.floor(account.cash + DAILY_GRANT + bonus);
  account.totalGranted = Math.floor(account.totalGranted + DAILY_GRANT);
  account.lastGrantDate = today;

  streak.currentStreak = nextStreak;
  streak.longestStreak = nextLongest;
  if (streak.totalBonus !== undefined) {
    streak.totalBonus = Math.floor(streak.totalBonus + bonus);
  }

  return {
    granted: true,
    grantAmount: DAILY_GRANT,
    bonusAmount: bonus,
    streak: { currentStreak: nextStreak, longestStreak: nextLongest },
    isNewStreakMilestone: bonus > 0,
  };
}

function ymdKst(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// executeCheckin: contract.ts의 executeCheckinFn 시그니처 구현체.
// 실제 지급 판정·스트릭 계산은 performDailyCheckin에 위임하고, 이 함수는 그 결과를
// storage.ts의 Account/StreakState에 반영(persist)한다. currentPortfolio는 이 계약이
// 요구하는 인자이지만 지급 판정에는 쓰이지 않는다(자산 평가는 Portfolio 소유 패킷 담당).
export function executeCheckin(
  _userId: string,
  _currentPortfolio: Portfolio
): { streakDays: number; dailyRewardKrw: number; isFirstCheckingToday: boolean } {
  const account = loadAccount();
  const streak = loadStreak();

  const checkinAccount: CheckinAccount = {
    cash: account.cash,
    lastGrantDate: ymdKst(account.lastGrantDate),
    totalGranted: account.totalGranted,
  };
  const checkinStreak: CheckinStreak = {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
  };

  const result = performDailyCheckin(checkinAccount, checkinStreak);

  if (result.granted) {
    saveAccount({
      ...account,
      cash: checkinAccount.cash,
      totalGranted: checkinAccount.totalGranted,
      lastGrantDate: new Date(),
    });
    saveStreak({
      ...streak,
      currentStreak: result.streak.currentStreak,
      longestStreak: result.streak.longestStreak,
      lastCheckInDate: todayKst(),
      totalBonus: streak.totalBonus + result.bonusAmount,
    });
  }

  return {
    streakDays: result.streak.currentStreak,
    dailyRewardKrw: result.grantAmount + result.bonusAmount,
    isFirstCheckingToday: result.granted,
  };
}
