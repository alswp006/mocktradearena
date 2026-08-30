// 투자성향 진단 퀴즈 — 8문항 4지선다, 결정적 채점 규칙(룰 기반, 생성형 AI 미사용).
// 점수 8~32 → 5단계 RiskType → 성향별 고정 추천 종목 3개.

import { INSTRUMENT_MAP } from "@/data/instruments";
import type { gradeQuizFn } from "@/lib/contract";

export type RiskType = "STABLE" | "STABLE_GROWTH" | "NEUTRAL" | "ACTIVE" | "AGGRESSIVE";

/** 선택지 인덱스(0~3) — 문항의 choices 배열 위치를 가리킨다. */
export type QuizAnswer = number;

export interface QuizChoice {
  label: string;
  score: number; // 1~4, choiceIdx + 1
}

export interface QuizQuestion {
  id: string;
  text: string;
  choices: QuizChoice[]; // 정확히 4개
}

const QUESTION_TEXTS: { text: string; options: [string, string, string, string] }[] = [
  {
    text: "투자로 모은 돈을 언제 쓸 계획인가요?",
    options: ["1년 안에", "1~3년 사이", "3~7년 사이", "7년 뒤에도 괜찮아요"],
  },
  {
    text: "한 달 만에 원금이 20% 줄면 어떻게 하나요?",
    options: ["전부 판다", "일부 판다", "그대로 둔다", "더 산다"],
  },
  {
    text: "투자 경험은 어느 정도인가요?",
    options: ["예·적금만 해봤다", "펀드나 ETF까지", "개별 주식까지", "파생·해외까지"],
  },
  {
    text: "기대하는 연 수익률은 어느 정도인가요?",
    options: ["3% 안팎", "5% 안팎", "10% 안팎", "20% 이상"],
  },
  {
    text: "월 소득에서 투자에 넣는 비중은요?",
    options: ["10% 미만", "10~20%", "20~40%", "40% 이상"],
  },
  {
    text: "투자 손실이 생활에 주는 영향은요?",
    options: ["당장 곤란해진다", "조금 부담된다", "견딜 만하다", "거의 없다"],
  },
  {
    text: "종목을 고를 때 먼저 보는 건 무엇인가요?",
    options: ["원금 보전", "꾸준한 배당", "성장 가능성", "단기 급등 가능성"],
  },
  {
    text: "시장이 크게 흔들릴 때 계좌를 얼마나 자주 보나요?",
    options: ["불안해서 못 본다", "하루 한 번", "가끔 확인한다", "기회를 찾아본다"],
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = QUESTION_TEXTS.map((q, idx) => ({
  id: `q${idx + 1}`,
  text: q.text,
  choices: q.options.map((label, choiceIdx) => ({ label, score: choiceIdx + 1 })),
}));

// 채점 가중치 — 문항 표시 점수(choice.score)와는 별개인 내부 규칙.
const ANSWER_WEIGHT: Record<QuizAnswer, number> = { 0: 0, 1: 1, 2: 1, 3: 3 };

function riskTypeOf(score: number): RiskType {
  if (score <= 12) return "STABLE";
  if (score <= 17) return "STABLE_GROWTH";
  if (score <= 22) return "NEUTRAL";
  if (score <= 27) return "ACTIVE";
  return "AGGRESSIVE";
}

/** 8문항 응답(선택지 인덱스 0~3)의 합산 점수(8~32)와 성향을 반환한다. */
export function scoreQuiz(answers: QuizAnswer[]): { score: number; type: RiskType } {
  const score = 8 + answers.reduce((sum, a) => sum + (ANSWER_WEIGHT[a] ?? 0), 0);
  return { score, type: riskTypeOf(score) };
}

// 계약(gradeQuizFn)의 3단계 profile은 이 파일의 5단계 RiskType을 축약한 값이다.
const RISK_TYPE_TO_PROFILE: Record<RiskType, "conservative" | "moderate" | "aggressive"> = {
  STABLE: "conservative",
  STABLE_GROWTH: "conservative",
  NEUTRAL: "moderate",
  ACTIVE: "aggressive",
  AGGRESSIVE: "aggressive",
};

/** 계약(gradeQuizFn) — JSON 문자열 답변을 채점해 점수·3단계 성향·응답 문항 수를 반환한다. */
export const gradeQuiz: gradeQuizFn = (answersJson) => {
  let answers: QuizAnswer[] = [];
  try {
    const parsed = JSON.parse(answersJson);
    if (Array.isArray(parsed)) {
      answers = parsed.filter((a): a is number => typeof a === "number" && a >= 0 && a <= 3);
    }
  } catch {
    // 잘못된 JSON은 빈 응답(score 8, STABLE→conservative)으로 처리
  }

  const { score, type } = scoreQuiz(answers);
  return { score, profile: RISK_TYPE_TO_PROFILE[type], questionsCorrect: answers.length };
};

export const RISK_LABEL: Record<RiskType, string> = {
  STABLE: "안정형",
  STABLE_GROWTH: "안정추구형",
  NEUTRAL: "위험중립형",
  ACTIVE: "적극투자형",
  AGGRESSIVE: "공격투자형",
};

export const RISK_DESCRIPTION: Record<RiskType, string> = {
  STABLE: "원금을 지키는 쪽이 마음 편한 성향이에요",
  STABLE_GROWTH: "안정을 우선하되 조금씩 수익도 노리는 성향이에요",
  NEUTRAL: "수익과 안정 사이에서 균형을 찾는 성향이에요",
  ACTIVE: "적극적으로 수익 기회를 찾는 성향이에요",
  AGGRESSIVE: "변동을 감수하고 수익을 노리는 성향이에요",
};

// 성향별 추천 종목 3개 — 고정 매핑(룰 기반). 모두 INSTRUMENT_MAP에 존재해야 한다.
const RECOMMENDED_SYMBOLS_BY_TYPE: Record<RiskType, [string, string, string]> = {
  STABLE: ["114260", "279530", "132030"],
  STABLE_GROWTH: ["069500", "102110", "114260"],
  NEUTRAL: ["069500", "379800", "005930"],
  ACTIVE: ["005930", "035420", "133690"],
  AGGRESSIVE: ["000660", "006400", "130680"],
};

for (const symbols of Object.values(RECOMMENDED_SYMBOLS_BY_TYPE)) {
  for (const symbol of symbols) {
    if (!INSTRUMENT_MAP[symbol]) {
      throw new Error(`recommendedSymbols: unknown instrument symbol "${symbol}"`);
    }
  }
}

/** 성향별 추천 종목 3개를 반환한다. 항상 결정적(동일 입력 → 동일 출력). */
export function recommendedSymbols(type: RiskType): string[] {
  return [...RECOMMENDED_SYMBOLS_BY_TYPE[type]];
}

// ── 진단 결과 저장(mta:quiz) ────────────────────────────────────
// storage.ts의 QuizResult(types.ts, 3단계 riskProfile)와는 별개 스키마라 같은 이름을 피한다.

export interface QuizRecord {
  answers: number[]; // 길이 8, 각 값 1~4
  score: number;
  type: RiskType;
  recommendedSymbols: string[];
  answeredAt: string; // ISO8601
}

const QUIZ_RECORD_KEY = "mta:quiz"; // storage.ts STORAGE_KEYS.quiz와 동일 키

export function saveQuizRecord(record: QuizRecord): void {
  try {
    localStorage.setItem(QUIZ_RECORD_KEY, JSON.stringify(record));
  } catch {
    // 저장 실패는 무시 — 세션 내 결과 화면은 location.state로 정상 동작
  }
}

export function loadQuizRecord(): QuizRecord | null {
  try {
    const raw = localStorage.getItem(QUIZ_RECORD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuizRecord;
  } catch {
    return null;
  }
}

export {
  getLeaderboardSeed,
  buildLeaderboard,
  clearLeaderboardSeedCache,
  generateLeaderboardSeeds,
  type LeaderboardEntry,
} from "@/lib/leaderboard";
