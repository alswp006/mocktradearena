# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
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
export type calculateMDDFn = (prices: number[]) => nu
```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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

// ── BacktestResultData (Packet 0015) ───────────────────────────────────
export interface SeriesPoint {
  date: string;
  value: number;
}

export interface YearlyReturnData {
  year: number;
  ret: number;
}

export interface BacktestResultData {
  series: SeriesPoint[];
  totalReturn: number;
  cagr: number;
  mdd: number;
  sharpe: number;
  volatility: number;
  yearlyReturn
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSection.tsx
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    DisclaimerNotice.tsx
    FloatingTabBar.tsx
    LoadingSkeletons.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
    TradeHistoryTab.tsx
  data/
    instruments.ts
  hooks/
  lib/
    backtest.ts
    checkin.ts
    contract.ts
    date.ts
    leaderboard.ts
    navigation.ts
    priceEngine.ts
    quiz.ts
    storage.ts
    tradeEngine.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Backtest.tsx
    BacktestResult.tsx
    Home.tsx
    Leaderboard.tsx
    Market.tsx
    Portfolio.tsx
    Quiz.tsx
    QuizResult.tsx
    Trade.tsx
    __TdsGallery.tsx
  store/
    AppStateContext.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- backtest.ts: export type BacktestCalcResult = BacktestResult |; export function runBacktest(preset: BacktestPreset): BacktestCalcResult; export function runBacktest( items: PresetItem[], years: BacktestYears, ): BacktestResultData; export function runBacktest( presetOrItems: BacktestPreset | PresetItem[], yearsArg?: BacktestYears, ): BacktestCalcResu
- checkin.ts: export interface BootstrapAccount; export interface BootstrapMeta; export function bootstrap(storage: Map<string, any>):; export interface CheckinAccount; export interface CheckinStreak; export interface DailyCheckInResult; export function performDailyCheckin(account: CheckinAccount, streak: CheckinStreak): DailyCheckInResult; export function executeCheckin( _userId: string, _currentPortfolio: Portfolio ):
- contract.ts: export type User =; export type Instrument =; export type Portfolio =; export type Trade =; export type RouteState =; export type BacktestResult =; export type QuizResult =; export type INSTRUMENTSFn = () => Instrument[]
- date.ts: export function todayKst(): string; export function toDayIndex(dateStr: string): number; export function addYears(dateStr: string, years: number): string; export function endOfMonth(dateStr: string): string; export function getKSTDate(): string; export function formatKstDateTime(date: Date): string; export function parseKSTDate(dateStr: string): Date; export function addDaysKST(dateStr: string, days: number): string
- leaderboard.ts: export interface LeaderboardEntry; export function getLeaderboardSeed(): LeaderboardEntry[]; export function clearLeaderboardSeedCache(): void; export function generateLeaderboardSeeds(): QuizLeaderboardEntry[]; export function buildLeaderboard( myTotalAsset: number, myReturnPct: number, myStreak: number ): LeaderboardEntry[]
- navigation.ts: export const MAIN_TAB_PATHS = ["/", "/market", "/portfolio", "/leaderboard"] as const; export type MainTabPath = (typeof MAIN_TAB_PATHS)[number]; export const MAIN_TAB_ITEMS: TabItem[] = [; export function isMainTabPath(pathname: string): boolean
- priceEngine.ts: export function hash32(str: string): number; export function mulberry32(seed: number): () => number; export function getClose(symbol: string, dateStr: string): number; export const getPriceForInstrument: (instrumentId: string, dateStr: string) => number = getClose; export function getDailySeries(symbol: string): PricePoint[]; export function getMonthlySeries(symbol: string): PricePoint[]
- quiz.ts: export type RiskType = "STABLE" | "STABLE_GROWTH" | "NEUTRAL" | "ACTIVE" | "AGGRESSIVE"; export type QuizAnswer = number; export interface QuizChoice; export interface QuizQuestion; export const QUIZ_QUESTIONS: QuizQuestion[] = QUESTION_TEXTS.map((q, idx) => (; export function scoreQuiz(answers: QuizAnswer[]):; export const gradeQuiz: gradeQuizFn = (answersJson) =>; export const RISK_LABEL: Record<RiskType, string> =
- storage.ts: export const STORAGE_KEYS =; export function loadAccount(): Account; export function saveAccount(account: Account, onQuotaExceeded?: QuotaExceededHandler): void; export function loadPositions(): PositionMap; export function savePositions(positions: PositionMap, onQuotaExceeded?: QuotaExceededHandler): void; export function loadTrades(): Trade[]; export function saveTrades(trades: Trade[], onQuotaExceeded?: QuotaExceededHandler): void; export function loadStreak(): StreakState
- tradeEngine.ts: export type TradeType = "BUY" | "SELL"; export interface TradeRequest; export interface TradePosition; export interface TradeRecord; export interface TradeAccount; export interface TradeResult; export function executeTrade( account: TradeAccount, positions: Map<string, TradePosition>, request: TradeRequest, trade
- types.ts: export type InstrumentType = "STOCK" | "ETF"; export interface Instrument; export interface PricePoint; export interface Account; export interface Position; export type PositionMap = Record<string, Position>; export type TradeSide = "BUY" | "SELL"; export i...
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입 + RouteState 계약 정의 (files: src/lib/types.ts)
- 0002: 종목 마스터 20종목 + KST 날짜 유틸 (files: src/data/instruments.ts, src/lib/date.ts)
- 0003: 결정적 가격 엔진 (hash32·mulberry32·Box–Muller) (files: src/lib/priceEngine.ts)
- 0005: 부트스트랩·일일지급·스트릭 + 거래 체결 엔진 (files: src/lib/checkin.ts, src/lib/tradeEngine.ts)
- 0008: 퀴즈 채점 규칙 + 리더보드 시드 생성 (files: src/lib/quiz.ts, src/lib/leaderboard.ts)
- 0009: 홈 화면 (S1) — 히어로·스트릭·메뉴 카드·고지 (files: src/pages/Home.tsx)
- 0010: 마켓 화면 (S2) — 목록·탭 필터·검색 (files: src/pages/Market.tsx)
- 0011: 주문 화면 (S3) — 매수/매도·미리보기·체결 (files: src/pages/Trade.tsx)
- 0012: 포트폴리오 (S4) — 보유종목 탭 (files: src/pages/Portfolio.tsx)
- 0013: 포트폴리오 거래내역 탭 + 대량 리스트 처리 (files: src/components/TradeHistoryTab.tsx, src/pages/Portfolio.tsx)
- 0014: 백테스트 구성 화면 (S5) — 종목/비중·실행·프리셋 (files: src/pages/Backtest.tsx)
- 0019: 라우팅 배선 + 전역 Provider + 탭바 노출 제어 (files: src/App.tsx)
- 0020: 광고 배치·로딩 스켈레톤·고지 컴포넌트 폴리시 (files: src/components/DisclaimerNotice.tsx, src/components/AdSection.tsx, src/components/LoadingSkeletons.tsx)

## TDD 상태
⚠️ TDD 테스트 파일 자동 작성에 실패했습니다. 소스 코드를 작성하기 전에 `src/__tests__/packet-XXXX.test.ts` 파일에 AC 기반 테스트를 먼저 작성하세요 (TDD red phase). 테스트 작성 후 구현하세요.

## Available exports from existing files
// src/App.tsx
export { MAIN_TAB_PATHS, MAIN_TAB_ITEMS, isMainTabPath } from '@/lib/navigation';
export function useRoute(): { current: RouteState; navigate: (screen: string, preview?: any) => void } {
export default function App() {

// src/components/AdSection.tsx
export function AdSection() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/DisclaimerNotice.tsx
export function DisclaimerNotice() {

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/LoadingSkeletons.tsx
export function HeroSkeleton() {
export function ListSkeleton({ rows, count = 5 }: { rows?: number; count?: number }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/components/TradeHistoryTab.tsx
export function TradeHistoryTab({

// src/data/instruments.ts
export const INSTRUMENTS: Instrument[] = [
export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(
export function getInstrument(symbol: string): Instrument | undefined {

// src/lib/backtest.ts
expo

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(1), general(9)

Key lessons (verify against actual code before applying):
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 영속 저장소에서 읽은 값은 항상 스키마 기본값으로 정규화해 배열·객체 타입을 보장한 뒤 반환하고, 화면은 빈/손상/부분 데이터에서도 렌더되도록 방어하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 정책·기능 제거형 리팩터링은 화면과 도메인 로직 레이어에서만 수행하고, package.json의 플랫폼 필수 의존성(디자인 시스템·플랫폼 SDK·프레임워크 코어)은 어떤 경우에도 삭제하지 말 것 — 필수 패키지 화이트리스트를 빌드 전 가드로 검증하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 공용 기반 모듈(상수·저장소·계산 유틸)이 실제로 머지되기 전에는 이를 import하는 화면·훅 패킷을 머지하지 말고, 모든 머지 게이트에 타입체크와 프로덕션 빌드 통과(미해결 import 0건)를 필수로 걸어라. (60% · 타 앱 1회 — 맹신 금지)