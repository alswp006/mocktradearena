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
export type calculateBacktestMetricsFn = (returns: number[]) => { cagr: number; maxDrawdown: number; sh
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
  vers
// ...truncated
```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    contract.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type Instrument =; export type Position =; export type Portfolio =; export type Trade =; export type AppState =; export type RouteState =; export type QuizResult =; export type LeaderboardEntry =
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type InstrumentType = "STOCK" | "ETF"; export interface Instrument; export interface PricePoint; export interface Account; export interface Position; export type PositionMap = Record<string, Position>; export type TradeSide = "BUY" | "SELL"; export interface Trade
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string; export function formatPercent(decimal: number, decimals = 2): string; export function formatDate(dateStr: string): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 엔티티 타입 + RouteState 계약 정의 (files: src/lib/types.ts)

## Available exports from existing files
// src/App.tsx
export default function App() {

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

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

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

// src/lib/contract.ts
export type Instrument = { id: string; name: string; category: "stock"|"etf"|"fund"; basePriceCents: number };
export type Position = { instrumentId: string; quantity: number; avgBuyPrice: number; currentPrice: number; unrealizedGainKrw: number };
export type Portfolio = { totalAssetKrw: number; totalGainKrw: number; positions: Position[]; lastUpdatedAt: string };
export type Trade = { id: string; instrumentId: string; type: "buy"|"sell"; quantity: number; pricePerUnit: number; executedAt: string; totalKrw: number };
export type AppState = { userId: string; portfolio: Portfolio; wallet: { balanceKrw: number }; lastCheckinDate: string; streakDays: number };
export type RouteState = { currentScreen: "home"|"market"|"trade"|"portfolio"|"backtest"|"quiz"|"quizResult"|"leaderboar

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(1), general(9)

Key lessons (verify against actual code before applying):
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 영속 저장소에서 읽은 값은 항상 스키마 기본값으로 정규화해 배열·객체 타입을 보장한 뒤 반환하고, 화면은 빈/손상/부분 데이터에서도 렌더되도록 방어하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 정책·기능 제거형 리팩터링은 화면과 도메인 로직 레이어에서만 수행하고, package.json의 플랫폼 필수 의존성(디자인 시스템·플랫폼 SDK·프레임워크 코어)은 어떤 경우에도 삭제하지 말 것 — 필수 패키지 화이트리스트를 빌드 전 가드로 검증하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 공용 기반 모듈(상수·저장소·계산 유틸)이 실제로 머지되기 전에는 이를 import하는 화면·훅 패킷을 머지하지 말고, 모든 머지 게이트에 타입체크와 프로덕션 빌드 통과(미해결 import 0건)를 필수로 걸어라. (60% · 타 앱 1회 — 맹신 금지)