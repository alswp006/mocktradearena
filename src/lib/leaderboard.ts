// 랭킹 리더보드 — 봇 49명 결정적 시드 생성 + 캐시 + 랭킹 조립. 룰 기반, 생성형 AI 미사용.
// PRNG는 priceEngine의 hash32(FNV-1a)·mulberry32를 재사용해 Math.random 없이 결정적으로 생성한다.

import { hash32, mulberry32 } from "@/lib/priceEngine";
import type { LeaderboardEntry as QuizLeaderboardEntry } from "@/lib/contract";

export interface LeaderboardEntry {
  id: string; // "me" | "bot-01" ... "bot-49"
  nickname: string;
  isMe: boolean;
  isFriend: boolean;
  totalAssetKrw: number;
  returnPct: number;
  streak: number;
}

const BOT_COUNT = 49;
const MIN_ASSET_KRW = 300_000;
const MAX_ASSET_KRW = 30_000_000;
const LEADERBOARD_SEED_KEY = "mta:leaderboardSeed"; // storage.ts STORAGE_KEYS.leaderboardSeed와 동일 키

const NICKNAME_POOL = [
  "불꽃개미", "가치투자러", "장기보유왕", "스윙마스터", "리밸런서",
  "배당사냥꾼", "익절요정", "존버클래식", "차트읽는사람", "리스크헤저",
  "물타기장인", "우량주러버", "국내파", "해외파", "분산투자자",
  "저점매수자", "추세추종러", "단타의신", "현금보유파", "적립식러버",
];

function generateBotSeed(): LeaderboardEntry[] {
  return Array.from({ length: BOT_COUNT }, (_, i) => {
    const rank = i + 1;
    const id = `bot-${String(rank).padStart(2, "0")}`;
    const rng = mulberry32(hash32(`leaderboard-bot|${id}`));

    const cycle = Math.floor(i / NICKNAME_POOL.length);
    const baseName = NICKNAME_POOL[i % NICKNAME_POOL.length];
    const nickname = cycle > 0 ? `${baseName}${cycle + 1}` : baseName;

    const totalAssetKrw = Math.round(MIN_ASSET_KRW + rng() * (MAX_ASSET_KRW - MIN_ASSET_KRW));
    const returnPct = Math.round((rng() * 100 - 20) * 100) / 100; // -20.00 ~ 80.00
    const streak = Math.floor(rng() * 31); // 0~30
    const isFriend = rng() < 0.2;

    return { id, nickname, isMe: false, isFriend, totalAssetKrw, returnPct, streak };
  });
}

let cachedSeed: LeaderboardEntry[] | null = null;

function readSeedFromStorage(): LeaderboardEntry[] | null {
  try {
    const raw = localStorage.getItem(LEADERBOARD_SEED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== BOT_COUNT) return null;
    return parsed as LeaderboardEntry[];
  } catch {
    return null;
  }
}

function writeSeedToStorage(seed: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_SEED_KEY, JSON.stringify(seed));
  } catch {
    // 저장 실패는 무시 — 다음 호출에서 재생성해도 결정적이라 무해함
  }
}

/** 봇 49명 시드를 최초 1회 생성해 mta:leaderboardSeed에 저장하고, 이후 호출은 저장값을 재사용한다. */
export function getLeaderboardSeed(): LeaderboardEntry[] {
  if (cachedSeed) return cachedSeed;

  const stored = readSeedFromStorage();
  if (stored) {
    cachedSeed = stored;
    return stored;
  }

  const generated = generateBotSeed();
  writeSeedToStorage(generated);
  cachedSeed = generated;
  return generated;
}

/** 테스트 전용 — 메모리 캐시와 저장값을 모두 비워 재생성을 강제한다. */
export function clearLeaderboardSeedCache(): void {
  cachedSeed = null;
  try {
    localStorage.removeItem(LEADERBOARD_SEED_KEY);
  } catch {
    // ignore
  }
}

/** 계약(generateLeaderboardSeedsFn) — 퀴즈 점수 기반 리더보드 봇 49명을 결정적으로 생성한다. */
export function generateLeaderboardSeeds(): QuizLeaderboardEntry[] {
  const seeded = Array.from({ length: BOT_COUNT }, (_, i) => {
    const userId = `bot-${String(i + 1).padStart(2, "0")}`;
    const rng = mulberry32(hash32(`quiz-leaderboard-bot|${userId}`));
    const questionsCorrect = Math.floor(rng() * 9); // 0~8
    const score = 8 + Math.round(rng() * 24); // 8~32, scoreQuiz와 동일 범위
    return { userId, score, questionsCorrect };
  });

  return seeded
    .sort((a, b) => b.score - a.score)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

/** 봇 49명 + 나를 합쳐 totalAssetKrw 내림차순(동점 시 nickname 오름차순)으로 정렬한다. */
export function buildLeaderboard(
  myTotalAsset: number,
  myReturnPct: number,
  myStreak: number
): LeaderboardEntry[] {
  const me: LeaderboardEntry = {
    id: "me",
    nickname: "나",
    isMe: true,
    isFriend: false,
    totalAssetKrw: myTotalAsset,
    returnPct: myReturnPct,
    streak: myStreak,
  };

  return [...getLeaderboardSeed(), me].sort((a, b) => {
    if (b.totalAssetKrw !== a.totalAssetKrw) return b.totalAssetKrw - a.totalAssetKrw;
    return a.nickname.localeCompare(b.nickname, "ko");
  });
}
