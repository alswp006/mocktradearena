/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 전역 사용자 엔티티 (구현: 패킷 0001) */
export type User = { id: string; name: string; knowledgePoints: number; streak: number; lastCheckinDate: string };

/** 종목 엔티티 (구현: 패킷 0001) */
export type Instrument = { code: string; name: string; sector: string; price: number };

/** 포트폴리오 엔티티 (구현: 패킷 0001) */
export type Portfolio = { userId: string; holdings: { code: string; quantity: number; buyPrice: number }[]; cashKrw: number };

/** 거래 기록 엔티티 (구현: 패킷 0001) */
export type Trade = { id: string; userId: string; code: string; side: 'BUY' | 'SELL'; quantity: number; price: number; executedAt: string };

/** 라우팅 상태 (구현: 패킷 0001) */
export type RouteState = { pathname: string; params?: Record<string, string>; state?: Record<string, unknown> };

/** 백테스트 결과 엔티티 (구현: 패킷 0001) */
export type BacktestResult = { cagr: number; mdd: number; sharpe: number; annualReturns: Record<string, number>; yearlyVolatility: number };

/** 퀴즈 결과 엔티티 (구현: 패킷 0001) */
export type QuizResult = { score: number; level: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'; nextQuizDate: string };

/** 20개 종목 마스터 상수 (구현: 패킷 0002) */
export type INSTRUMENTSFn = () => Instrument[];

/** KST 현재 날짜 (ISO 문자열) (구현: 패킷 0002) */
export type getKSTDateFn = (date?: Date) => string;

/** KST 날짜 더하기 (구현: 패킷 0002) */
export type addDaysKSTFn = (date: string, days: number) => string;

/** 결정적 가격 생성 (hash32 기반) (구현: 패킷 0003) */
export type generateDeterministicPriceFn = (code: string, date: string, basePrice: number, volatility: number) => number;

/** localStorage 안전 읽기 (복구 포함) (구현: 패킷 0004) */
export type storageGetFn = <T = unknown>(key: string) => T | null;

/** localStorage 안전 쓰기 (Quota 처리) (구현: 패킷 0004) */
export type storageSetFn = (key: string, value: unknown) => boolean;

/** localStorage 제거 (구현: 패킷 0004) */
export type storageRemoveFn = (key: string) => void;

/** 거래 체결 엔진 (구현: 패킷 0005) */
export type executeTradeForPortfolioFn = (portfolio: Portfolio, trade: Omit<Trade, 'id' | 'executedAt'>) => { success: boolean; updatedPortfolio?: Portfolio; error?: string };

/** 일일 지급 적용 (구현: 패킷 0005) */
export type applyDailyStipendFn = (user: User, today: string) => { user: User; stipendKrw: number };

/** 체크인 스트릭 갱신 (구현: 패킷 0005) */
export type updateStreakFn = (user: User, today: string) => User;

/** 전역 상태 훅 (AppStateContext) (구현: 패킷 0006) */
export type useAppStateFn = () => { user: User; portfolio: Portfolio; setUser: (u: User) => void; setPortfolio: (p: Portfolio) => void; trades: Trade[] };

/** 백테스트 종합 지표 계산 (구현: 패킷 0007) */
export type calculateBacktestMetricsFn = (dailyReturns: number[], yearlyBreakdown: Record<string, number[]>) => BacktestResult;

/** 연복합성장률 (구현: 패킷 0007) */
export type calculateCAGRFn = (startValue: number, endValue: number, years: number) => number;

/** 최대 낙폭 (구현: 패킷 0007) */
export type calculateMDDFn = (prices: number[]) => number;

/** 샤프 비율 (구현: 패킷 0007) */
export type calculateSharpeRatioFn = (dailyReturns: number[], riskFreeRate?: number) => number;

/** 퀴즈 채점 규칙 (구현: 패킷 0008) */
export type scoreQuizFn = (answers: number[], quizVersion: string) => { score: number; level: string };

/** 리더보드 시드 생성 (구현: 패킷 0008) */
export type generateLeaderboardSeedFn = (users: User[], backtest: Record<string, BacktestResult>) => { rank: number; user: User; score: number }[];
