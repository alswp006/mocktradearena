/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 종목 마스터 타입, 모든 거래·백테스트에서 사용 (구현: 패킷 0001) */
export type Instrument = { id: string; name: string; category: "stock"|"etf"|"fund"; basePriceCents: number };

/** 보유 종목 항목, Portfolio 구성 (구현: 패킷 0001) */
export type Position = { instrumentId: string; quantity: number; avgBuyPrice: number; currentPrice: number; unrealizedGainKrw: number };

/** 포트폴리오 전체, AppState의 핵심 (구현: 패킷 0001) */
export type Portfolio = { totalAssetKrw: number; totalGainKrw: number; positions: Position[]; lastUpdatedAt: string };

/** 체결 거래 기록, 거래내역·백테스트에서 사용 (구현: 패킷 0001) */
export type Trade = { id: string; instrumentId: string; type: "buy"|"sell"; quantity: number; pricePerUnit: number; executedAt: string; totalKrw: number };

/** 앱 전역 상태 스키마, 0006 Provider가 관리 (구현: 패킷 0001) */
export type AppState = { userId: string; portfolio: Portfolio; wallet: { balanceKrw: number }; lastCheckinDate: string; streakDays: number };

/** 라우팅 상태, 0019가 관리 (구현: 패킷 0001) */
export type RouteState = { currentScreen: "home"|"market"|"trade"|"portfolio"|"backtest"|"quiz"|"quizResult"|"leaderboard"; tradePreview?: { instrumentId: string; quantity: number; type: "buy"|"sell" } };

/** 퀴즈 제출 결과, 0008·0017에서 사용 (구현: 패킷 0001) */
export type QuizResult = { userId: string; answersJson: string; score: number; profile: "conservative"|"moderate"|"aggressive"; submittedAt: string };

/** 랭킹 항목, 0018에서 표시 (구현: 패킷 0001) */
export type LeaderboardEntry = { rank: number; userId: string; score: number; questionsCorrect: number };

/** 종목의 지정 날짜 가격 조회, 0005·0011에서 호출 (구현: 패킷 0003) */
export type getPriceForInstrumentFn = (instrumentId: string, dateStr: string) => number;

/** 현재 KST 시각 ISO 문자열, 모든 시간 처리 (구현: 패킷 0002) */
export type getKSTDateFn = () => string;

/** KST 문자열을 Date로 파싱 (구현: 패킷 0002) */
export type parseKSTDateFn = (dateStr: string) => Date;

/** KST 날짜에 days 더한 ISO 문자열 반환 (구현: 패킷 0002) */
export type addDaysKSTFn = (dateStr: string, days: number) => string;

/** localStorage 안전 조회 (파싱 복구, Quota 처리) (구현: 패킷 0004) */
export type getStorageItemFn = <T>(key: string, defaultValue: T) => T;

/** localStorage 안전 저장 (QuotaExceededError 처리) (구현: 패킷 0004) */
export type setStorageItemFn = (key: string, value: any) => boolean;

/** 일일 체크인 실행, 스트릭·보상 계산 (구현: 패킷 0005) */
export type executeCheckinFn = (userId: string, currentPortfolio: Portfolio) => { streakDays: number; dailyRewardKrw: number; isFirstCheckingToday: boolean };

/** 거래 체결, Portfolio·Trade 생성 (구현: 패킷 0005) */
export type executeTradeFn = (userId: string, walletBalance: number, trade: { instrumentId: string; quantity: number; type: "buy"|"sell"; pricePerUnit: number }) => { success: boolean; newWalletBalance: number; trade?: Trade; error?: string };

/** 시계열 수익률로부터 백테스트 지표 계산 (구현: 패킷 0007) */
export type calculateBacktestMetricsFn = (returns: number[]) => { cagr: number; maxDrawdown: number; sharpeRatio: number; winRate: number };

/** 퀴즈 답변 채점 및 투자성향 분류 (구현: 패킷 0008) */
export type gradeQuizFn = (answersJson: string) => { score: number; profile: "conservative"|"moderate"|"aggressive"; questionsCorrect: number };

/** 리더보드 초기 시드 데이터 생성 (구현: 패킷 0008) */
export type generateLeaderboardSeedsFn = () => LeaderboardEntry[];

/** KRW 통화 포맷 (예: '1,234,567원') (구현: 패킷 0001) */
export type formatCurrencyFn = (krw: number) => string;

/** 백분율 포맷 (예: 0.1234 → '12.34%') (구현: 패킷 0001) */
export type formatPercentFn = (decimal: number, decimals?: number) => string;

/** ISO 날짜를 로케일 형식으로 (예: '2026-08-31') (구현: 패킷 0001) */
export type formatDateFn = (dateStr: string) => string;

/** 글로벌 상태 훅, 모든 페이지에서 호출 (구현: 패킷 0006) */
export type useAppStateFn = () => { state: AppState; updatePortfolio: (p: Portfolio) => void; updateWallet: (b: number) => void; updateStreak: (days: number) => void; executeCheckin: () => Promise<void> };

/** 라우팅 상태 훅, 네비게이션 제어 (구현: 패킷 0019) */
export type useRouteFn = () => { current: RouteState; navigate: (screen: string, preview?: any) => void };
