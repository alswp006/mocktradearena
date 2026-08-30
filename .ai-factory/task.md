# TASK — MockTradeArena

> 기준: SPEC "MockTradeArena" (F1~F8, 총 64 AC)
> 스택: Vite + React + TypeScript + TDS(`@toss/tds-mobile`) + react-router-dom + localStorage
> 제외: 토스 로그인 세팅, TDS 세팅, `AdSlot`/`TossRewardAd`/`ScreenScaffold`/`SubmitFooter`/`SummaryHero`/`Sparkline`/`MiniBar`/`FloatingTabBar` 구현 (템플릿 제공 — **사용만** 함)
>
> **변경 이력 (교차검증 반영)**
> - `[FIXED]` Task 4.3의 `Depends on`에 **Task 2.8** 추가 — 4.3이 `src/store/AppStateContext.tsx`를 직접 수정하므로 "파일을 수정하는 태스크는 그 파일을 생성한 태스크에 직접 의존한다" 규칙을 만족시킴 (기존에는 4.1→3.\*→2.8 전이 의존만 존재)
> - `[FIXED]` Task 4.3에 `AppStateContext.tsx` 수정 범위를 한정하는 DoD 항목 추가 — 2.8이 확정한 공개 계약(노출 값·1회 실행 보장)을 깨지 않도록 명시
> - `[ADDED]` 문서 하단에 **파일 수정 ↔ 의존성 매트릭스** 절 추가 — 동일 파일을 여러 태스크가 건드릴 때 직접 의존 관계를 한눈에 검증 가능하게 함

---

## Epic 1. TypeScript 타입 + 인터페이스

**Risk Assessment**
- **Complexity**: Low
- **Risk factors**: (a) 페이지 간 `location.state` 형태 불일치로 런타임 크래시, (b) `years` 리터럴 유니온(`1|3|5|10`)을 `number`로 느슨하게 두면 백테스트 계산 분기 오류, (c) 금액 타입을 `number`로 통일하지 않으면 `toLocaleString` 표시 깨짐
- **Mitigation**: 모든 런타임 코드보다 **먼저** 타입을 확정하고, `RouteState`를 단일 소스로 정의해 모든 페이지가 이를 import하도록 강제한다. 이후 Epic 2~4의 모든 태스크는 이 파일에 의존하므로 형태 불일치가 컴파일 타임에 잡힌다.

### Task 1.1 엔티티 타입 + RouteState 계약 정의
- **Description**: SPEC Data Models의 모든 인터페이스와 라우트 state 계약을 **순수 타입 파일**로 정의한다. 런타임 코드(함수/상수) 일절 없음.
- **DoD**:
  - `src/lib/types.ts`에 다음이 export 됨: `InstrumentType`, `Instrument`, `PricePoint`, `Account`, `Position`, `PositionMap`, `TradeSide`, `Trade`, `StreakState`, `PresetItem`, `BacktestPreset`, `YearlyReturn`, `BacktestResult`, `RiskType`, `QuizResult`, `LeaderboardEntry`, `AppMeta`, `BacktestYears`
  - `BacktestYears = 1 | 3 | 5 | 10` 리터럴 유니온으로 정의됨
  - `RouteState`가 아래와 **정확히** 동일하게 정의됨:
    ```ts
    export type RouteState = {
      "/": null;
      "/market": { from: 'portfolio' } | null;
      "/trade/:symbol": { symbol: string; from: 'market' | 'portfolio' } | null;
      "/portfolio": { justTradedSymbol: string } | null;
      "/backtest": { presetId: string } | null;
      "/backtest/result": { presetId: string; years: BacktestYears } | null;
      "/quiz": null;
      "/quiz/result": { score: number; type: RiskType } | null;
      "/leaderboard": null;
    };
    ```
  - `STORAGE_KEYS` 상수는 이 파일에 **넣지 않는다**(Task 2.3 소관). 타입 외 값 export 0개
  - `npx tsc --noEmit` 통과, `vite build` 성공
- **Covers**: (기반 계약 — 직접 커버 AC 없음. F1~F8 전 태스크의 선행 조건)
- **Files**: `src/lib/types.ts`
- **Depends on**: none

---

## Epic 2. 데이터 레이어 (순수 로직 · UI 없음)

**Risk Assessment**
- **Complexity**: High
- **Risk factors**:
  - (a) 가격 엔진이 비결정적이면 백테스트/포트폴리오/랭킹 수치가 렌더마다 흔들려 F1-AC1, F5-AC1이 전부 실패 → `Date.now()`/`Math.random()` 오염이 최대 리스크
  - (b) 10년치 × 20종목 일간 시리즈(≈73,000 포인트)를 매 렌더 재계산하면 200ms 예산(F1-AC6) 초과
  - (c) `localStorage` QuotaExceeded 시 앱 크래시(F1-AC5) — 특히 `mta:trades` 100KB
  - (d) 부동소수 오차로 `avgPrice`, `fee`가 AC의 정수 기대값(예: `299895`, `1365`)과 1원 어긋남
  - (e) 시스템 시계 역행(F2-AC8) 시 음수 일수 계산으로 스트릭 폭주
- **Mitigation**: 가격 엔진(2.2)을 스토리지(2.3)보다 먼저 만들고 결정성 테스트를 DoD에 못 박는다. 시리즈 캐시는 모듈 스코프 `Map`으로 심볼당 1회만 계산(localStorage 저장 금지). 스토리지 래퍼(2.3)를 **모든** 쓰기 경로의 단일 게이트로 만들어 Quota/파싱 복구를 한 곳에 가둔다. 금액 계산은 전부 `Math.floor` + 정수 연산으로 고정하고 AC의 기대 정수값을 그대로 단위 테스트에 넣는다. 날짜 비교는 문자열 `YYYY-MM-DD` 사전순 비교로만 수행해 역행을 자연 차단한다.

### Task 2.1 종목 마스터 20종목 정의
- **Description**: 주식 10 + ETF 10, 총 20개의 `Instrument` 상수 배열을 번들 데이터로 작성한다. localStorage 미사용.
- **DoD**:
  - `INSTRUMENTS: readonly Instrument[]` export, 길이 정확히 `20`
  - `type === 'STOCK'` 10개, `type === 'ETF'` 10개
  - 모든 `symbol`이 `/^\d{6}$/` 매칭, 중복 0건 (`new Set(symbols).size === 20`)
  - 각 항목의 `basePrice`는 정수 ≥ 1000, `annualDrift`는 `-0.1 ~ 0.2`, `annualVol`은 `0.05 ~ 0.5` 범위 내
  - `getInstrument(symbol: string): Instrument | undefined` 헬퍼 export (마스터에 없는 심볼은 `undefined` 반환, throw 금지)
  - `INSTRUMENT_MAP: Record<string, Instrument>` export (O(1) 조회용)
  - 검색용으로 `삼성`을 포함하는 종목명이 2개 이상 존재 (F3-AC3 대비: `삼성전자`, `삼성바이오로직스`)
- **Covers**: [F1-AC2]
- **Files**: `src/data/instruments.ts`
- **Depends on**: Task 1.1

### Task 2.2 결정적 가격 엔진 (hash32 · mulberry32 · Box–Muller)
- **Description**: `(symbol, date)` → 정수 가격을 반환하는 결정적 GBM 가격 엔진. 세션 메모리 캐시 포함.
- **DoD**:
  - `hash32(s: string): number`, `mulberry32(seed: number): () => number`, `gaussian(rand): number`(Box–Muller) 내부 구현
  - `getClose(symbol: string, date: string): number` export — 반환값 `Number.isInteger === true` && `>= 100`
  - `getClose("005930", "2024-03-15")`를 3회 호출 시 **완전히 동일한 값** 반환 (테스트로 검증)
  - 시드는 `hash32(symbol + '|' + dayIndex)`만 사용 — 소스 내 `Math.random()`, `Date.now()`, `new Date()` (인자 없는) 호출 0건
  - 일간 재귀: `close_0 = basePrice` (기준일 `2016-01-01`), `r_t = drift/252 + vol/Math.sqrt(252)*z_t`, `close_t = Math.max(100, Math.floor(close_{t-1} * (1 + r_t)))`
  - `getDailySeries(symbol): PricePoint[]`는 모듈 스코프 `Map<string, PricePoint[]>`에 캐시 — 동일 심볼 2회 호출 시 재계산 0회 (호출 카운터로 검증)
  - `getMonthlySeries(symbol, startDate, endDate): PricePoint[]` — 일간 시리즈에서 각 월의 **마지막 캘린더 일자**를 샘플링
  - `getInstrument`가 `undefined`를 주는 심볼에 대해 `getClose`는 throw하지 않고 `0`을 반환 (F5-AC6 대비)
  - 20개 심볼 전체 일간 시리즈 계산이 로컬에서 **200ms 이내** 완료 (`performance.now()` 측정 로그로 확인 후 로그 제거)
  - localStorage 쓰기 0건
- **Covers**: [F1-AC1]
- **Files**: `src/lib/priceEngine.ts`, `src/lib/date.ts` (KST `todayKst()`, `toDayIndex()`, `addYears()`, `endOfMonth()`, `prevMonthEnd()`)
- **Depends on**: Task 2.1

### Task 2.3 localStorage 안전 래퍼 (파싱 복구 · Quota 처리)
- **Description**: 모든 저장소 접근의 단일 게이트. 스키마 키 상수, 안전 read/write, 손상 JSON 복구, QuotaExceeded 재시도.
- **DoD**:
  - `STORAGE_KEYS` 상수 export: `mta:meta`, `mta:account`, `mta:positions`, `mta:trades`, `mta:streak`, `mta:presets`, `mta:lastBacktest`, `mta:quiz`, `mta:leaderboardSeed`
  - `safeRead<T>(key, fallback: T): T` — `JSON.parse` 실패 시 예외를 던지지 않고 `fallback` 반환 + 해당 키를 `JSON.stringify(fallback)`으로 덮어쓰기 + **`console.error` 호출 0회**
  - `localStorage.setItem("mta:positions", "{not-json")` 상태에서 `loadPositions()` 호출 시 `{}` 반환 + `mta:positions === "{}"` (테스트)
  - `safeWrite(key, value, onQuotaExceeded?)` — `QuotaExceededError` catch 시 `mta:trades`의 **오래된 100건 삭제 후 1회 재시도**, 재시도도 실패하면 `onQuotaExceeded()` 콜백 호출(throw 금지)
  - 엔티티별 load/save 함수 export: `loadAccount/saveAccount`, `loadPositions/savePositions`, `loadTrades/saveTrades`, `loadStreak/saveStreak`, `loadPresets/savePresets`, `loadLastBacktest/saveLastBacktest`, `loadQuiz/saveQuiz`, `loadMeta/saveMeta`, `loadLeaderboardSeed/saveLeaderboardSeed`
  - `saveTrades`는 저장 전 배열 길이를 **500으로 트림**(오래된 것부터 삭제, 최신이 배열 끝)
  - 각 load 함수의 fallback 기본값은 SPEC "Data Storage" 표의 초기값과 일치
- **Covers**: [F1-AC4, F1-AC5, F5-AC7]
- **Files**: `src/lib/storage.ts`
- **Depends on**: Task 1.1

### Task 2.4 부트스트랩 · 일일 가상자금 지급 · 출석 스트릭 로직
- **Description**: 최초 진입 초기화 + KST 날짜 변경 시 자금 지급/스트릭 갱신을 수행하는 **순수 함수 + 실행 함수**. UI 없음(결과만 반환).
- **DoD**:
  - `bootstrap(): void` — `mta:account` 부재 시 `{ cash: 1000000, lastGrantDate: todayKst(), totalGranted: 1000000, createdAt: <ISO> }`, `mta:meta` 부재 시 `{ schemaVersion: 1, disclaimerSeen: false, onboardedAt: <ISO>, rewardUnlockedPresetIds: [] }` 생성
  - `runDailyCheckIn(today: string): DailyCheckInResult` export
    — `DailyCheckInResult = { granted: boolean; grantAmount: number; bonusAmount: number; streak: number; isNewStreakMilestone: boolean }`
  - `lastGrantDate === today` → `{ granted: false, grantAmount: 0, bonusAmount: 0 }`, `cash`/`lastGrantDate` **불변** (2회 연속 호출해도 동일)
  - `lastGrantDate > today` (시계 역행) → `granted: false`, `cash`·`lastGrantDate` 불변 — 문자열 사전순 비교로 판정
  - `lastGrantDate < today` → `cash += 1000000`, `lastGrantDate = today`, `totalGranted += 1000000`, `granted: true`
  - 스트릭: `lastCheckInDate`가 어제면 `currentStreak += 1`, 그 이전이면 `currentStreak = 1`(`longestStreak`은 기존값 유지), `longestStreak = Math.max(longest, current)`
  - 보너스 테이블: `streak >= 7 → 500000`, `>= 5 → 300000`, `>= 3 → 100000`, else `0`. 보너스는 `cash`와 `totalBonus`에 가산
  - 단위 테스트 3건 통과: (i) `cash 250000 / last 2026-08-30 / today 2026-08-31` → `cash 1250000, totalGranted 4000000`, (ii) `streak 2 / last 2026-08-30 / today 2026-08-31` → `streak 3, totalBonus 100000, cash += 1100000`, (iii) `last 2026-08-28 / today 2026-08-31` → `streak 1, bonus 0`
  - `getTotalAsset(account, positions, today): number` export = `cash + Σ(qty × getClose(symbol, today))`, 마스터에 없는 심볼은 **제외**
- **Covers**: [F1-AC3, F2-AC1, F2-AC2, F2-AC3, F2-AC4, F2-AC8]
- **Files**: `src/lib/bootstrap.ts`, `src/lib/dailyCheckIn.ts`
- **Depends on**: Task 2.2, Task 2.3

### Task 2.5 거래 체결 엔진 (수수료 · 검증 · 평균단가)
- **Description**: 매수/매도 체결의 순수 계산 + 검증 + 커밋 로직. UI 없음.
- **DoD**:
  - `calcBuyFee(qty, price) = Math.floor(qty*price*0.00015)`
  - `calcSellFee(qty, price) = Math.floor(qty*price*0.00015) + Math.floor(qty*price*0.0018)`
  - `previewOrder(side, symbol, qty, price, account, positions): OrderPreview` — `{ amount, fee, netTotal, cashAfter }` 반환
  - `validateOrder(...): { ok: true } | { ok: false; message: string }`
    — 수량이 `0` / `""` / 소수(`1.5`) → `"수량을 1주 이상 입력해주세요"`
    — 매수 시 `qty*price + fee > cash` → `"잔액이 부족해요"`
    — 매도 시 `qty > 보유수량` → `` `보유 수량은 ${held}주예요` ``
  - `executeOrder(...)` — 검증 실패 시 저장소 **일절 변경하지 않고** 실패 결과 반환
  - 매수 성공 시 `cash -= (amount + fee)`, `positions[symbol].qty += qty`, `avgPrice = Math.floor((oldQty*oldAvg + qty*price)/(oldQty+qty))`
  - 매도 성공 시 `cash += (amount - fee)`, `qty` 차감, **결과 `qty === 0`이면 `positions`에서 키 삭제**
  - `Trade` 1건 append (`id: crypto.randomUUID()`, `tradedAt: ISO8601`), `saveTrades`로 저장(500건 상한은 2.3에서 처리) — 신규 항목은 배열 **최신 위치(끝)**
  - 단위 테스트 4건 통과: (i) BUY 10@70000, cash 1000000 → `cash 299895, fee 105`, (ii) SELL 10@70000 avg 60000 → `fee 1365, cash 698635, positions["005930"] 삭제됨`, (iii) BUY 10@40000 위에 기존 `{qty:10, avg:30000}` → `qty 20, avgPrice 35000`, (iv) 500건 상태에서 1건 추가 → 길이 500 유지 & 신규 항목 존재
- **Covers**: [F4-AC1, F4-AC2, F4-AC3, F5-AC7]
- **Files**: `src/lib/trade.ts`
- **Depends on**: Task 2.3, Task 2.2

### Task 2.6 백테스트 계산 엔진 (시계열 · CAGR · MDD · 샤프)
- **Description**: 프리셋 구성 → `BacktestResult` 산출. 순수 함수, UI 없음.
- **DoD**:
  - `runBacktest(items: PresetItem[], years: BacktestYears, presetId: string): BacktestResult` export
  - `endDate` = 직전 월말, `startDate` = `endDate` 기준 `years`년 전 같은 달의 말일 (모두 `YYYY-MM-DD`)
  - `initialAmount = 10000000` 고정, 종목별 배분 `Math.floor(10000000 * weight / 100)`, 시작 수량 = `배분금액 / getClose(symbol, startDate)` (소수 허용)
  - `monthlyEquity[i] = Math.floor(Σ(수량_j × monthClose_j[i]))`, 길이 `years*12 + 1` (years=5 → **61**)
  - `totalReturnPct = (finalAmount - 10000000)/10000000*100`
  - `cagrPct = ((finalAmount/10000000) ** (1/years) - 1) * 100`
  - `mddPct = min over i of ((equity[i] - runningMax[i]) / runningMax[i]) * 100` — 결과는 `<= 0`
  - `volatilityPct` = 월수익률 표준편차 × `Math.sqrt(12)` × 100
  - `sharpe = (연환산 월수익률 평균 - 0.03) / (연환산 월수익률 표준편차)`
  - 모든 `*Pct`/`sharpe`는 **소수 2자리 반올림** (`Math.round(x*100)/100`)
  - `yearly: YearlyReturn[]` 길이 === `years`
  - 동일 입력 2회 호출 시 `JSON.stringify` 결과가 **완전히 동일**(결정성 테스트)
  - `runBacktest` 자체는 저장소를 건드리지 않음 (저장은 호출 측 책임)
  - `validatePreset(items, name)`: 비중 합계, 종목 수(1~5), 이름 길이(1~20)를 검사해 `{ ok, message }` 반환
- **Covers**: [F6-AC1(계산부), F7-AC1(계산부), F7-AC7(계산부)]
- **Files**: `src/lib/backtest.ts`
- **Depends on**: Task 2.2, Task 1.1

### Task 2.7 퀴즈 채점 규칙 + 리더보드 시드 생성
- **Description**: 8문항 룰 기반 성향 판정 + 봇 49명 결정적 시드 생성/정렬 로직. 생성형 AI 미사용.
- **DoD**:
  - `QUIZ_QUESTIONS`: 8문항 × 4보기 상수 (각 보기 `value: 1|2|3|4`)
  - `scoreQuiz(answers: number[]): { score: number; type: RiskType; recommendedSymbols: string[] }`
    — `answers.length !== 8`이거나 값이 1~4 밖이면 throw 대신 `score`를 clamp
    — 판정: `8~12 STABLE`, `13~17 STABLE_GROWTH`, `18~22 NEUTRAL`, `23~27 ACTIVE`, `28~32 AGGRESSIVE`
    — `recommendedSymbols`는 성향별 **고정 매핑 정확히 3개**, 모두 `INSTRUMENT_MAP`에 존재
    — 테스트: `[4,4,3,4,3,4,4,4]` → `score 30, type "AGGRESSIVE"`, 추천 3개
  - `RISK_TYPE_LABEL: Record<RiskType, string>` — `AGGRESSIVE → "공격투자형"` 등 5개
  - `getLeaderboardSeed(): LeaderboardEntry[]` — 없으면 `hash32` 기반으로 봇 **49명** 결정적 생성 후 `mta:leaderboardSeed`에 저장, 있으면 그대로 로드. 재호출 시 동일 배열
  - `isFriend: true`인 봇이 1명 이상 포함되도록 생성 (친구 탭 정상 경로 확보)
  - `buildLeaderboard(seed, me: LeaderboardEntry): LeaderboardEntry[]` — `me` 포함 총 **50개**, `totalAssetKrw` **내림차순**, 동점 시 `nickname` 오름차순 정렬
  - `me`는 저장하지 않고 인자로만 주입됨
- **Covers**: [F8-AC1(판정부), F8-AC4(정렬부)]
- **Files**: `src/lib/quiz.ts`, `src/lib/leaderboard.ts`, `src/data/quizQuestions.ts`
- **Depends on**: Task 2.1, Task 2.3

### Task 2.8 앱 상태 관리 (AppStateProvider)
- **Description**: 저장소 로드 결과를 React 상태로 들고 있으면서, 부트스트랩/일일 체크인을 **앱 생애 1회만** 실행하는 경량 Context 스토어.
- **DoD**:
  - `AppStateProvider` + `useAppState()` export (`src/store/AppStateContext.tsx`)
  - 노출 값(**공개 계약** — 이후 태스크가 이 파일을 수정할 때 제거·시그니처 변경 금지): `{ account, positions, trades, streak, meta, quiz, ready, checkInResult, reload(), setDisclaimerSeen(), refreshAfterTrade(), unlockPreset(presetId) }`
  - `useEffect` 안에서 `bootstrap()` → `runDailyCheckIn(todayKst())` 순으로 실행하되, **모듈 스코프 플래그 또는 `useRef`로 1회만 실행** (React 18 StrictMode 이중 마운트에서도 지급 2회 발생하지 않음 — 테스트로 검증)
  - `checkInResult`는 지급이 발생한 경우에만 non-null (홈 화면 Toast/BottomSheet 트리거용)
  - `unlockPreset(presetId)`은 `meta.rewardUnlockedPresetIds`에 append하되 **최대 20개**(초과 시 오래된 것부터 제거) 후 `saveMeta`
  - Quota 실패 시 `onQuotaExceeded` 콜백으로 `quotaError: boolean` 플래그를 세워 화면이 Toast를 띄울 수 있게 함
  - `ready === false` 동안 하위 화면은 Skeleton을 렌더할 수 있도록 플래그 제공
  - `main.tsx`에서 `<AppStateProvider>`가 `<BrowserRouter>` 안쪽을 감쌈, `vite build` 성공
- **Covers**: [F2-AC4, F1-AC5(UI 연결부)]
- **Files**: `src/store/AppStateContext.tsx`, `src/main.tsx`
- **Depends on**: Task 2.4, Task 2.5, Task 2.3
- **Downstream file consumers (수정 예정 태스크)**: Task 4.3 (`src/store/AppStateContext.tsx`에 프리워밍 로직 추가)

---

## Epic 3. 핵심 UI 페이지

**Risk Assessment**
- **Complexity**: High
- **Risk factors**:
  - (a) **`location.state` 없이 직접 진입/새로고침 시 크래시** — 결과 화면(`/backtest/result`, `/quiz/result`)에서 `.map()` 호출로 전원 완주 실패한 실사고 패턴 (2026-08-03 SplitMate)
  - (b) TDS 컴포넌트에 Tailwind/인라인 여백을 덮어써 UI 붕괴 → 검수 반려
  - (c) 키보드 노출 시 `SubmitFooter`/마지막 행이 가려져 주문·검색 완주 불가 (F3-AC5, F4-AC8)
  - (d) 거래내역 120건 전체 DOM 렌더로 스크롤 프레임 드랍 (F5-AC5)
  - (e) 페이지가 계산 로직을 자체 구현해 Epic 2와 수치가 어긋남
- **Mitigation**: Epic 2를 전부 선행시켜 페이지는 **표시 전용**으로만 두고, 계산은 반드시 `src/lib/*`를 import한다. state 수신 화면(3.3, 3.6, 3.8, 3.11)에는 "state 없이 직접 진입해도 크래시하지 않는다"는 **별도 DoD 항목**을 강제한다. 간격은 TDS `Spacing`만 사용하고 커스텀 CSS는 flex/grid 배치에만 허용한다. 페이지를 1화면 1태스크(큰 화면은 탭/섹션 단위로 2분할)로 쪼개 10분 예산을 지킨다.

### Task 3.1 홈 화면 (S1) — 히어로 · 스트릭 · 메뉴 카드 · 고지 다이얼로그
- **Description**: 총 평가자산 히어로, 30일 추이 Sparkline, 메뉴 카드 4개, 일일지급 Toast / 스트릭 BottomSheet / 최초 고지 AlertDialog를 렌더한다. 지급·스트릭 계산은 `useAppState().checkInResult`를 **표시만** 한다.
- **DoD**:
  - `ScreenScaffold`로 감싼 `HomeScreen` 렌더, raw `div` 골격 0개
  - `data-testid="home-asset-hero"` `SummaryHero` 1개 — 총 평가자산 CountUp, 타이포 `t2`, 손익률 배지
  - `data-testid="home-trend-sparkline"` `Sparkline` 1개 — 최근 30일 자산 추이(현금 + 보유종목 일별 평가액)
  - `data-testid="home-menu-card"` `Card` **정확히 4개**: 모의매매 / 백테스트 / 투자성향 / 랭킹, 각 카드 높이 `>= 72px`
  - 카드 탭 → `navigate('/market')`, `navigate('/backtest')`, `navigate('/quiz')`, `navigate('/leaderboard')` (모두 state 없음)
  - 보유 요약 `ListRow` 탭 → `navigate('/portfolio')`
  - `checkInResult.granted === true` → TDS Toast `"오늘의 가상자금 1,000,000원이 지급됐어요"`
  - `checkInResult.bonusAmount > 0` → TDS BottomSheet `` `${streak}일 연속 출석! 보너스 ${bonus.toLocaleString('ko-KR')}원` `` (예: `"3일 연속 출석! 보너스 100,000원"`)
  - `checkInResult.granted === false` → Toast·BottomSheet 모두 렌더되지 않음 (같은 날 2회 재진입 시 `cash` 불변)
  - `meta.disclaimerSeen === false` → TDS AlertDialog `"본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다."` + `"확인"` 탭 시 `setDisclaimerSeen()` 호출, 재진입 시 미표시
  - `positions === {}` → `data-testid="home-holdings-empty"`에 `Asset.ContentIcon` + `"아직 보유 종목이 없어요"` + `"모의매매 시작하기"` `Button display="block"`
  - `quiz === null` → 투자성향 카드 라벨 `"투자성향 진단하기"`, 존재 시 `RISK_TYPE_LABEL[quiz.type]`(예: `"공격투자형"`)로 교체
  - `ready === false` 동안 Hero/Sparkline은 TDS `Skeleton`
  - `AdSlot`은 메뉴 카드 섹션 **아래**, `FloatingTabBar` **위** 1개
  - 모든 탭 가능한 요소 `>= 44px`, HEX 하드코딩 0건, Tailwind 여백 오버라이드 0건
- **Covers**: [F2-AC1, F2-AC2, F2-AC4, F2-AC5, F2-AC6, F2-AC7, F8-AC7]
- **Files**: `src/pages/HomeScreen.tsx`
- **Depends on**: Task 2.8

### Task 3.2 마켓 화면 (S2) — 목록 · 탭 필터 · 검색 · 주문 이동
- **Description**: 20종목 리스트, 전체/주식/ETF 탭, 종목명·코드 검색, 60일 Sparkline, 행 탭 시 주문 이동.
- **DoD**:
  - `ScreenScaffold` 필수, `data-testid="market-list"` 컨테이너 존재
  - TDS `ListRow` **20개** 렌더 — 각 행에 종목명 / 6자리 코드 / 현재가(`toLocaleString('ko-KR')` + `"원"`) / 등락률 배지, 행 높이 `>= 56px`
  - 등락률 = `(close(today) - close(어제)) / close(어제) * 100`, 소수 2자리, `+1.24%` / `-0.83%` 형식(부호 필수)
  - TDS `Tab` 3개(전체/주식/ETF), 각 `>= 44px`. `"ETF"` 선택 시 `market-list` 자식 수 **10**
  - TDS `TextField`(`inputMode="text"`) 검색 — `"삼성"` 입력 시 종목명 포함 행만 표시, `"005930"` 등 코드 부분일치도 지원
  - 검색어 `"zzzz"` → `data-testid="market-empty"`에 `Asset.ContentIcon` + `"검색 결과가 없어요"`, 행 0개
  - 행 탭 → `navigate('/trade/005930', { state: { symbol: "005930", from: "market" } })` — 타입은 `RouteState["/trade/:symbol"]`
  - 가격 캐시 미준비 상태에서 TDS `Skeleton` **20행** 표시 후 실제 데이터로 교체
  - 키보드: TextField 포커스 시 목록 컨테이너 하단 패딩 = 키보드 높이(`visualViewport` 기반)로 마지막 행이 가려지지 않음, 목록 스크롤 시 `blur()`로 dismiss + 입력값 유지
  - 네이티브 세로 스크롤 사용(가상 스크롤 미사용, 오버스크롤 바운스 유지)
- **Covers**: [F3-AC1, F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC7]
- **Files**: `src/pages/MarketScreen.tsx`, `src/hooks/useKeyboardInset.ts`
- **Depends on**: Task 2.8, Task 2.2

### Task 3.3 주문 화면 (S3) — 매수/매도 · 미리보기 · 검증 · 체결
- **Description**: 시장가 즉시 체결 화면. 세그먼트, 수량 입력, 미리보기 Card, 하단 고정 제출. 계산·검증은 `src/lib/trade.ts` 호출만.
- **DoD**:
  - `ScreenScaffold` 필수, 1차 액션은 `SubmitFooter` 하단 고정 `Button`(`"매수하기"` / `"매도하기"`)
  - **state 방어**: `const state = (useLocation().state as RouteState["/trade/:symbol"]) ?? null;` 후 `state?.symbol ?? useParams().symbol`을 사용. 심볼이 없거나 `INSTRUMENT_MAP`에 없으면 `<Navigate to="/market" replace />` — **state 없이 `/trade/005930`으로 직접 진입/새로고침해도 크래시하지 않는다**
  - `data-testid="order-preview-card"` `Card` 1개 — 예상 체결금액 / 수수료 / 주문 후 잔액, 총액은 타이포 `t3` 강조, 값은 `previewOrder()` 결과 그대로
  - 매수 성공: `executeOrder` 호출 → Toast `` `${name} ${qty}주 매수 체결` ``(예: `"삼성전자 10주 매수 체결"`) → `navigate('/portfolio', { state: { justTradedSymbol: symbol } })`
  - 매도 성공: 동일 흐름으로 Toast + `/portfolio` 이동
  - 잔액 부족 → TextField 하단 `"잔액이 부족해요"`, 저장소 3개 키 모두 불변
  - 보유수량 초과 → `` `보유 수량은 ${held}주예요` ``
  - 수량이 `0`/`""`/`"1.5"` → `"수량을 1주 이상 입력해주세요"` + 제출 버튼 `disabled` 유지
  - 매도 탭에서 보유 0주 → 수량 TextField `disabled` + `"보유 중인 수량이 없어요"` 표시
  - 수량 TextField `inputMode="numeric"`, 포커스 시 `SubmitFooter`가 키보드 위로 올라가 가려지지 않음
  - `+10 / +100 / 최대` TDS `Chip` 3개로 키보드 없이 입력 가능, 각 `>= 44px`
  - 체결 처리 중 `SubmitFooter` 버튼 `loading` + `disabled` (중복 탭 시 체결 1회만)
  - `Top` 뒤로 → `navigate(-1)`
- **Covers**: [F4-AC1, F4-AC2, F4-AC4, F4-AC5, F4-AC6, F4-AC7, F4-AC8]
- **Files**: `src/pages/TradeScreen.tsx`
- **Depends on**: Task 2.5, Task 2.8, Task 3.2

### Task 3.4 포트폴리오 — 보유종목 탭 (S4 전반부)
- **Description**: 총 평가자산 히어로 + 보유 종목별 손익 카드(비중 MiniBar 포함) + 빈 상태. 탭 셸도 여기서 구성.
- **DoD**:
  - `ScreenScaffold` 필수, TDS `Tab` 2개(보유종목/거래내역) 셸 구성, 각 `>= 44px`
  - `data-testid="portfolio-hero"` `SummaryHero` 1개 — 총 평가자산 CountUp 타이포 `t2` + 손익률 배지
  - 보유 종목마다 `data-testid="portfolio-position-card"` `Card` 1개, 각 Card 안에 비중 `MiniBar` **1개**
  - 종목 계산 표시: `{qty:10, avgPrice:60000}` & 현재가 `70000` → 평가금액 `700,000원`, 평가손익 `+100,000원`, 손익률 `+16.67%`
  - 비중(%) = `qty*현재가 / 총평가자산 * 100`
  - `INSTRUMENT_MAP`에 없는 심볼(`"999999"`)은 **목록에서 제외 + 총 평가자산에서도 제외**, `console.error` 0회로 렌더 완료
  - `positions === {}` → `data-testid="portfolio-empty"`에 `Asset.ContentIcon` + `"보유 중인 종목이 없어요"` + `"마켓 둘러보기"` `Button display="block"` → `navigate('/market', { state: { from: 'portfolio' } })`
  - 포지션 카드 탭 → `navigate('/trade/:symbol', { state: { symbol, from: 'portfolio' } })`
  - **state 방어**: `const state = (useLocation().state as RouteState["/portfolio"]) ?? null;` — `justTradedSymbol`이 없어도 정상 렌더(있으면 해당 카드 하이라이트)
  - `ready === false` → Hero + 카드 3개 `Skeleton`
- **Covers**: [F5-AC1, F5-AC2, F5-AC3, F5-AC6]
- **Files**: `src/pages/PortfolioScreen.tsx`, `src/components/PositionCard.tsx`
- **Depends on**: Task 2.8, Task 2.2

### Task 3.5 포트폴리오 — 거래내역 탭 + 가상 스크롤 (S4 후반부)
- **Description**: 최신순 거래내역 리스트, 100건 초과 시 윈도잉 렌더, 빈 상태.
- **DoD**:
  - `"거래내역"` 탭에 TDS `ListRow` 리스트 — 종목명 / `매수`·`매도` 배지 / 수량 / 체결가 / 체결금액 / `tradedAt`(KST `YYYY-MM-DD HH:mm`)
  - **최신순 정렬** (`tradedAt` 내림차순)
  - `trades.length === 120`일 때 초기 DOM 행 수 `<= 30`이고, 스크롤 시 행이 추가 렌더되며 **120건 전체에 도달 가능**
  - `trades === []` → `"아직 거래 내역이 없어요"` + 리스트 행 0개
  - 행 높이 `>= 44px`, 윈도잉은 IntersectionObserver 기반 점진 로드 또는 슬라이스 윈도우로 구현(외부 UI 라이브러리 도입 금지)
  - 탭 전환 시 스크롤 위치가 초기화되고 크래시하지 않음
- **Covers**: [F5-AC4, F5-AC5]
- **Files**: `src/pages/PortfolioScreen.tsx`, `src/components/TradeHistoryList.tsx`
- **Depends on**: Task 3.4

### Task 3.6 백테스트 구성 — 종목/비중 선택 UI (S5 전반부)
- **Description**: 20종목 Chip 선택, 기간 Tab, 비중 입력, 비중 합계 카드. 검증 메시지 표시.
- **DoD**:
  - `ScreenScaffold` 필수
  - 종목 선택은 TDS `Chip` **20개**, 각 터치 타깃 `>= 44px`
  - 기간 선택은 TDS `Tab` **4개**(`1년/3년/5년/10년`), 각 `>= 44px`, 기본값 `5년`
  - 이미 5개 선택 상태에서 6번째 Chip 탭 → 선택되지 않고 Toast `"종목은 최대 5개까지 담을 수 있어요"`
  - 선택 종목마다 비중 TextField(`inputMode="numeric"`, 5~100 정수)
  - `data-testid="weight-sum-card"` `Card` 1개 — 합계 `60%` 형식(타이포 `t3`) + `MiniBar`
  - 합계 ≠ 100 → `` `비중 합계가 100%가 되어야 해요 (현재 ${sum}%)` `` 표시 + `SubmitFooter` 실행 버튼 `disabled`
  - `items.length === 0` → `"종목을 1개 이상 선택해주세요"` 표시 + 실행 버튼 `disabled`
  - 실행 버튼은 `SubmitFooter` 하단 고정, 비중/이름 입력 포커스 시 키보드 위로 이동
  - **state 방어**: `const state = (useLocation().state as RouteState["/backtest"]) ?? null;` — `state?.presetId`가 있고 해당 프리셋이 존재하면 구성 프리필, 없거나 프리셋 미존재면 **빈 구성으로 정상 렌더**(크래시 금지)
- **Covers**: [F6-AC2, F6-AC3, F6-AC4, F6-AC8]
- **Files**: `src/pages/BacktestSetupScreen.tsx`
- **Depends on**: Task 2.6, Task 2.8

### Task 3.7 백테스트 구성 — 실행 · 프리셋 저장/목록 (S5 후반부)
- **Description**: 실행 버튼으로 `runBacktest` 호출 후 결과 화면 이동, 프리셋 CRUD.
- **DoD**:
  - 실행 탭 → `SubmitFooter` 버튼 `loading` + `disabled`, `runBacktest(items, years, presetId)` 호출
  - `years: 5` 구성 시 `monthlyEquity.length === 61`인 `BacktestResult`가 `mta:lastBacktest`에 저장됨
  - 이어서 `navigate('/backtest/result', { state: { presetId, years } })` — `RouteState["/backtest/result"]`와 타입 일치
  - 중복 탭해도 계산 **1회만** 수행되고 **1,000ms 이내** 결과 화면 전환
  - `"프리셋 저장"` → `mta:presets`에 append + Toast `"프리셋이 저장됐어요"`, `id: crypto.randomUUID()`, `createdAt: ISO8601`
  - `presets.length === 10` 상태에서 저장 시도 → 저장되지 않고 `"프리셋은 최대 10개까지 저장할 수 있어요"` 표시
  - 프리셋 이름 TextField(1~20자), 미입력 시 저장 버튼 `disabled`
  - 저장된 프리셋은 TDS `ListRow`로 나열, 탭 시 구성 프리필 + 삭제 액션 제공
  - 프리셋 0개 → `Asset.ContentIcon` + `"저장된 프리셋이 없어요"`
- **Covers**: [F6-AC1, F6-AC5, F6-AC6, F6-AC7]
- **Files**: `src/pages/BacktestSetupScreen.tsx`, `src/components/PresetList.tsx`
- **Depends on**: Task 3.6

### Task 3.8 백테스트 리포트 — 무료 요약 + state 방어 (S6 전반부)
- **Description**: 게이트 밖 무료 영역(Hero + Sparkline)과 state/결과 부재 시 폴백 처리.
- **DoD**:
  - `ScreenScaffold` 필수
  - **state 방어 (필수 패턴)**:
    ```ts
    const state = (useLocation().state as RouteState["/backtest/result"]) ?? null;
    const last = loadLastBacktest();
    const result = state ? (last?.presetId === state.presetId ? last : last) : last;
    if (!result) return <EmptyBacktest />;   // 크래시 금지
    ```
    — `location.state === null`로 `/backtest/result` **직접 진입/새로고침**해도 크래시하지 않고 `mta:lastBacktest`를 렌더
  - `mta:lastBacktest`도 없으면 `"먼저 백테스트를 실행해주세요"` + `"백테스트 하러 가기"` `Button display="block"` → `navigate('/backtest')`
  - `monthlyEquity`가 `undefined`/빈 배열이어도 `.map()` 크래시 없이 빈 차트 처리
  - `data-testid="summary-hero"` `SummaryHero` — 최종 평가금액 CountUp(`14,327,000원` 형식) 타이포 `t2` + 총 수익률 배지(`+43.27%`)
  - `data-testid="equity-sparkline"` `Sparkline` 1개 — `monthlyEquity` 전체 점(years=5 → 61개) 렌더
  - 기간 배지 TDS `Chip` 1개(`5년`)
  - `Top` 뒤로 → `navigate('/backtest')`, `"다시 구성하기"` → `navigate('/backtest', { state: { presetId } })`
- **Covers**: [F7-AC1, F7-AC5]
- **Files**: `src/pages/BacktestResultScreen.tsx`
- **Depends on**: Task 2.6, Task 2.8

### Task 3.9 백테스트 리포트 — 리워드 광고 게이팅 상세 지표 (S6 후반부)
- **Description**: CAGR/MDD/샤프/연변동성 4개 Card + 연도별 MiniBar를 `TossRewardAd`로 게이팅하고 해제 상태를 `mta:meta`에 영속화.
- **DoD**:
  - 상세 지표 4개 `Card` + 연도별 `MiniBar` 영역을 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>`로 감쌈. 무료 요약(Hero + Sparkline)은 게이트 **밖**
  - `data-testid="metric-card"` `Card` **정확히 4개**(CAGR / MDD / 샤프지수 / 연변동성), 각 핵심 값 타이포 `t2~t3`, MDD 값에는 하락 배지 부착
  - `data-testid="yearly-bar"` `MiniBar`가 `yearly.length`(= `years`)만큼 렌더
  - `rewardUnlockedPresetIds`에 `presetId` **없음** → `"상세 리포트 보기"` `Button`(`>= 48px`, `display="block"`) 표시. 광고 시청 완료 시 상세 카드 표시 + `unlockPreset(presetId)` 호출로 ID append
  - `rewardUnlockedPresetIds`에 `presetId` **있음** → 광고 없이 상세 즉시 표시, `"상세 리포트 보기"` 버튼 **렌더되지 않음**
  - 광고 로드 실패 → TDS Toast `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"`, 상세는 잠금 유지, **`console.error` 0회**
  - 마운트 직후 지표 계산 중에는 상세 카드 자리에 TDS `Skeleton` **4개** 표시 후 실제 값으로 교체
  - `presetId`가 없는 경우(state null 폴백 경로)에도 `mta:lastBacktest.presetId`를 키로 사용해 게이팅이 정상 동작
- **Covers**: [F7-AC2, F7-AC3, F7-AC4, F7-AC6, F7-AC7]
- **Files**: `src/pages/BacktestResultScreen.tsx`, `src/components/MetricCard.tsx`
- **Depends on**: Task 3.8

### Task 3.10 투자성향 퀴즈 화면 (S7)
- **Description**: 8문항 4지선다 진행 화면. 진행률 MiniBar, 이전 문항 복원, 미선택 차단.
- **DoD**:
  - `ScreenScaffold` 필수, 상단 `data-testid="quiz-progress"` `MiniBar` 1개(`1/8`~`8/8`)
  - 보기는 TDS `ListRow` **4개**, 각 높이 `>= 56px`, 선택 시 선택 상태 시각 표시
  - 1차 액션은 `SubmitFooter` — 1~7문항은 `"다음"`, 8문항은 `"결과 보기"`
  - 현재 문항 미응답 → 다음 문항으로 이동하지 않고 `"답변을 선택해주세요"` 표시 + 버튼 `disabled` 유지
  - `Top` 뒤로 탭 → 이전 문항으로 이동하며 **기존 선택값이 선택 상태로 복원**(5→4번 이동 시 4번 답 유지). 1번 문항에서 뒤로 → `navigate(-1)`
  - 마지막 응답 후 `scoreQuiz(answers)` 호출 → `mta:quiz = { answers, score, type, recommendedSymbols, answeredAt }` 저장
  - `navigate('/quiz/result', { state: { score, type } })` — `RouteState["/quiz/result"]`와 타입 일치
  - `[4,4,3,4,3,4,4,4]` 응답 시 저장값이 `score: 30, type: "AGGRESSIVE", recommendedSymbols.length === 3`
  - `FloatingTabBar` 숨김 라우트
- **Covers**: [F8-AC1(진행/저장부), F8-AC2, F8-AC3]
- **Files**: `src/pages/QuizScreen.tsx`
- **Depends on**: Task 2.7, Task 2.8

### Task 3.11 퀴즈 결과 화면 (S8)
- **Description**: 성향 히어로 + 추천 종목 3개 Card + state 폴백.
- **DoD**:
  - **state 방어**: `const state = (useLocation().state as RouteState["/quiz/result"]) ?? null;` → `state ?? loadQuiz()` 순으로 폴백. **둘 다 없으면** `"진단을 먼저 진행해주세요"` + `"진단 시작"` `Button` → `navigate('/quiz')`. state 없이 직접 진입/새로고침해도 크래시하지 않음
  - `data-testid="quiz-type-hero"` `SummaryHero` — `RISK_TYPE_LABEL[type]`(예: `"공격투자형"`) 타이포 `t2` + 점수 배지(`30점`)
  - `data-testid="recommend-card"` `Card` **정확히 3개** — 종목명 / 코드 / 현재가, 각 카드 탭 → `navigate('/trade/:symbol', { state: { symbol, from: 'market' } })`
  - `recommendedSymbols`가 비어있거나 마스터에 없는 심볼이면 해당 카드 제외 후 크래시 없이 렌더
  - `AdSlot` 1개가 추천 카드 **아래**, 고지 문구 **위**에 배치
  - 화면 최하단에 `"본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다."` 고정 노출
- **Covers**: [F8-AC1(결과 표시부)]
- **Files**: `src/pages/QuizResultScreen.tsx`
- **Depends on**: Task 3.10

### Task 3.12 랭킹 화면 (S9)
- **Description**: 봇 49 + 나 = 50명 리더보드, 전체/친구 탭, 내 순위 히어로 및 하단 고정 행, 로그인 미연동 폴백.
- **DoD**:
  - `ScreenScaffold` 필수
  - `data-testid="rank-hero"` `SummaryHero` — 내 순위 CountUp 타이포 `t2` + 총 평가자산
  - `getLeaderboardSeed()` 49명 + `me`(총 평가자산 = `getTotalAsset(...)`, 저장하지 않고 매 렌더 계산) → `buildLeaderboard`로 총 **50개**, `totalAssetKrw` 내림차순 / 동점 시 `nickname` 오름차순
  - `isMe === true` 행에 `data-testid="leaderboard-me-row"` 부여 + 강조 스타일 + **화면 하단 고정 노출**
  - 순위 행은 TDS `ListRow`, 높이 `>= 56px`, 연속 출석은 TDS `Chip` 배지
  - TDS `Tab` 2개(전체/친구), 각 `>= 44px`. 친구 탭은 `isFriend === true`만 표시
  - `isFriend === true`가 0개 → `data-testid="leaderboard-friend-empty"`에 `Asset.ContentIcon` + `"아직 함께하는 친구가 없어요"`
  - `getIsTossLoginIntegratedService()`가 `false` → 봇 49명 랭킹 정상 표시 + 내 행 닉네임을 `"나"`로 대체, 에러 화면 없음, **`console.error` 0회**. Promise reject 시에도 `"나"` 폴백
  - 로딩 중 TDS `Skeleton` 10행
  - `AdSlot` 1개가 순위 목록 **아래**, 내 순위 고정 행과 겹치지 않음
  - 50행은 네이티브 스크롤, 목록 길이가 50 초과가 되면 윈도잉 진입하도록 임계값 상수화
- **Covers**: [F8-AC4, F8-AC5, F8-AC6, F8-AC8]
- **Files**: `src/pages/LeaderboardScreen.tsx`
- **Depends on**: Task 2.7, Task 2.8

---

## Epic 4. 통합 + 폴리시

**Risk Assessment**
- **Complexity**: Medium
- **Risk factors**:
  - (a) 라우트 미등록/오탈자로 `/trade/:symbol` 진입 시 흰 화면, 알 수 없는 경로에서 404 사망
  - (b) `FloatingTabBar`가 주문·결과 화면까지 노출되어 `SubmitFooter`와 겹침
  - (c) `AdSlot`이 콘텐츠 위에 오버레이되거나 `position: fixed`로 목록을 가려 검수 반려 (F3-AC8, F5-AC8, F7-AC8)
  - (d) 광고 SDK 외 외부 도메인 요청·`window.open` 잔존으로 심사 반려 (F1-AC7, F1-AC8)
  - (e) 로딩 상태 누락으로 첫 진입 시 빈 화면 깜빡임 (F1-AC6)
  - (f) **Epic 4 태스크가 Epic 2/3에서 만든 파일을 수정하면서 원 작성 태스크에 직접 의존하지 않으면**, 코딩 에이전트가 해당 파일의 확정 계약(공개 API·초기화 1회 보장)을 모른 채 덮어써 회귀가 발생
- **Mitigation**: 모든 페이지 태스크(Epic 3)를 끝낸 뒤에 라우팅을 배선해 각 화면이 독립적으로 이미 컴파일·동작함을 보장한다. 광고 배치와 고지 문구는 페이지별로 흩어지지 않도록 마지막에 **일괄 점검 태스크**로 몰아 검수 기준을 한 번에 검증한다. 정적 금지 패턴 검사는 `grep` 기반 DoD로 자동 확인 가능하게 만든다. **파일을 수정하는 모든 태스크는 그 파일을 생성한 태스크를 `Depends on`에 직접 명시**하고, 문서 하단 "파일 수정 ↔ 의존성 매트릭스"로 이를 검증한다.

### Task 4.1 라우팅 배선 + FloatingTabBar 노출 제어
- **Description**: 9개 라우트 등록, 와일드카드 폴백, 탭바 조건부 렌더.
- **DoD**:
  - `src/App.tsx`에 SPEC "전역 라우팅"과 동일한 `<Routes>` 9개 + `<Route path="*" element={<Navigate to="/" replace />} />` 등록
  - `FloatingTabBar`는 `/`, `/market`, `/portfolio`, `/leaderboard` **4개 라우트에서만** 렌더, 나머지(`/trade/:symbol`, `/backtest`, `/backtest/result`, `/quiz`, `/quiz/result`)에서는 숨김 (`useLocation().pathname` 기반)
  - 탭바 노출 라우트에서는 콘텐츠 하단에 탭바 높이만큼 safe padding이 확보되어 마지막 요소가 가려지지 않음
  - 존재하지 않는 경로(`/nope`) 진입 시 `/`로 replace 이동, 흰 화면 없음
  - `/`→`/market`→`/trade/005930`→`/portfolio`→`/backtest`→`/backtest/result`→`/quiz`→`/quiz/result`→`/leaderboard` 전 경로를 **주소창 직접 입력(새로고침)으로** 진입해도 전부 크래시 없이 렌더 또는 안전 리다이렉트
  - `vite build` 성공, `npx tsc --noEmit` 통과
- **Covers**: [F7-AC5(라우팅 폴백부), F8-AC7(라우팅부)]
- **Files**: `src/App.tsx`, `src/components/AppTabBar.tsx`
- **Depends on**: Task 3.1 ~ Task 3.12

### Task 4.2 광고 배치 일괄 점검 (AdSlot 위치 계약)
- **Description**: 5개 화면의 `AdSlot` 위치를 SPEC 계약대로 배치·검증한다. `TossRewardAd` 게이트는 Task 3.9에서 완료.
- **DoD**:
  - 마켓: `AdSlot` 1개가 `market-list`의 **마지막 행 아래**에 위치, 행 위 오버레이 없음, `position: fixed` 미사용
  - 포트폴리오: `AdSlot` 1개가 **보유종목 섹션과 거래내역 섹션 사이**에 위치, 어떤 `Card`와도 겹치지 않음
  - 백테스트 리포트: `AdSlot` 1개가 지표 카드 섹션 **아래**, 고지 문구 **위**에 위치
  - 홈: `AdSlot` 1개가 메뉴 카드 아래 · `FloatingTabBar` 위
  - 랭킹: `AdSlot` 1개가 순위 목록 아래, `leaderboard-me-row` 고정 행과 겹치지 않음
  - 모든 `AdSlot`은 `adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID}` 사용, 하드코딩 ID 0건
  - 각 화면당 `AdSlot` 개수 **정확히 1개** (중복 렌더 0)
  - `.env.example`에 `VITE_TOSS_AD_GROUP_ID`, `VITE_TOSS_AD_SLOT_ID` 항목 명시
  - 기존 화면의 `data-testid`·네비게이션 계약을 변경하지 않음 (Epic 3에서 확정된 DoD 회귀 0건)
- **Covers**: [F3-AC8, F5-AC8, F7-AC8]
- **Files**: `src/pages/MarketScreen.tsx`, `src/pages/PortfolioScreen.tsx`, `src/pages/BacktestResultScreen.tsx`, `src/pages/HomeScreen.tsx`, `src/pages/LeaderboardScreen.tsx`, `.env.example`
- **Depends on**: Task 4.1 *(파일 원작성: 3.1 홈, 3.2 마켓, 3.4/3.5 포트폴리오, 3.8/3.9 리포트, 3.12 랭킹 — 모두 4.1이 직접 의존하므로 1홉으로 커버됨)*

### Task 4.3 로딩/스켈레톤 통일 + 계산 성능 예산
- **Description**: 시세 계산 중 Skeleton 표시를 전 화면에 일관 적용하고 200ms 예산을 확인한다. 20종목 일간 시리즈 프리워밍을 `AppStateProvider`에 추가한다.
- **DoD**:
  - 가격 캐시 미준비 상태에서 마켓 화면 마운트 시 TDS `Skeleton` **20행** 표시, 계산 완료(**200ms 이내**) 후 Skeleton 제거되고 실제 데이터로 교체
  - 백테스트 결과 화면 상세 지표 계산 중 `Skeleton` **4개** 표시 후 교체
  - 홈 Hero/Sparkline, 포트폴리오 Hero+카드 3개, 랭킹 10행 Skeleton이 `ready === false` 동안 표시
  - 20종목 일간 시리즈 프리워밍이 `requestIdleCallback`(미지원 시 `setTimeout(0)`)으로 앱 부팅 시 1회 수행되어 화면 전환 시 재계산 0회
  - **`src/store/AppStateContext.tsx` 수정 범위 제한 (Task 2.8 계약 보존)**:
    — 2.8이 정의한 노출 값(`account, positions, trades, streak, meta, quiz, ready, checkInResult, reload, setDisclaimerSeen, refreshAfterTrade, unlockPreset, quotaError`)을 **제거하거나 시그니처를 변경하지 않는다**
    — `bootstrap()` / `runDailyCheckIn()`의 **1회 실행 보장(StrictMode 이중 마운트 방어)을 깨뜨리지 않는다** — 프리워밍은 기존 1회 실행 가드와 **분리된 별도 `useEffect`**로 추가하고, 프리워밍 자체도 `useRef` 가드로 1회만 수행
    — 회귀 테스트: StrictMode에서 마운트 후 `mta:account.cash`가 일일지급 1회분만 증가(2.8의 기존 테스트 재실행 통과)
  - 성능 측정: 마켓 마운트~Skeleton 제거까지 `<= 200ms` (로컬 측정 후 계측 코드 제거)
  - Skeleton → 실제 데이터 전환 시 레이아웃 점프(높이 변화) 없음
- **Covers**: [F1-AC6, F3-AC6, F7-AC6]
- **Files**: `src/components/LoadingStates.tsx`, `src/pages/MarketScreen.tsx`, `src/store/AppStateContext.tsx`
- **Depends on**: Task 4.1, **Task 2.8** *(`src/store/AppStateContext.tsx`를 직접 수정하므로 원작성 태스크에 직접 의존)*

### Task 4.4 심사 컴플라이언스 최종 점검 (고지 문구 · 외부 이탈 · 콘솔 클린)
- **Description**: 투자 고지 문구 공통 컴포넌트화, 외부 도메인 이탈 패턴 제거, 콘솔 에러 0 검증.
- **DoD**:
  - `<InvestmentDisclaimer />` 공통 컴포넌트(TDS `Paragraph.Text`) 생성 — `"본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다."`
  - 수익률·리포트 노출 화면 4곳(홈 / 포트폴리오 / 백테스트 리포트 / 퀴즈 결과) **최하단**에 고정 노출
  - `grep -rn "window.open" src/` 결과 **0건**, `grep -rn "location.href *= *['\"]http" src/` 결과 **0건**
  - `grep -rniE "설치|다운로드" src/` — 앱 설치 유도 UI 텍스트 **0건**
  - `grep -rn "#[0-9a-fA-F]\{3,6\}" src/` — HEX 색상 하드코딩 0건(`var(--tds-color-*)` 또는 TDS 컴포넌트만 사용)
  - shadcn/ui, MUI, Ant Design, Chakra UI 의존성 `package.json`에 0개
  - `vite build` 산출물 실행 후 홈 → 마켓 → 주문 → 포트폴리오 → 백테스트 → 랭킹 순회 시 **`console.error` 호출 0회**
  - 동일 순회 중 네트워크 탭에 광고 SDK 도메인 외 외부 요청 **0건**, CORS 에러 **0건**
  - `TossPurchase`, `grantPromotionReward` 사용 0건 (MVP 범위 외 확인)
  - 모든 탭 가능한 요소 터치 타깃 `>= 44×44px` 육안/DevTools 확인 완료
  - Task 4.2가 배치한 `AdSlot` 위치 계약을 깨지 않음 (고지 문구는 항상 `AdSlot` **아래**)
- **Covers**: [F1-AC7, F1-AC8]
- **Files**: `src/components/InvestmentDisclaimer.tsx`, `src/pages/HomeScreen.tsx`, `src/pages/PortfolioScreen.tsx`, `src/pages/BacktestResultScreen.tsx`, `src/pages/QuizResultScreen.tsx`
- **Depends on**: Task 4.2, Task 4.3

---

## 파일 수정 ↔ 의존성 매트릭스

> 규칙: **한 파일을 여러 태스크가 건드리면, 나중 태스크는 그 파일을 생성한 태스크에 (직접 또는 1홉 내 명시적 의존으로) 도달 가능해야 한다.**

| 파일 | 생성 | 수정 태스크 | 의존 경로 | 판정 |
|---|---|---|---|---|
| `src/lib/types.ts` | 1.1 | — | — | ✓ |
| `src/data/instruments.ts` | 2.1 | — | — | ✓ |
| `src/lib/priceEngine.ts`, `src/lib/date.ts` | 2.2 | — | — | ✓ |
| `src/lib/storage.ts` | 2.3 | — | — | ✓ |
| `src/lib/bootstrap.ts`, `src/lib/dailyCheckIn.ts` | 2.4 | — | — | ✓ |
| `src/lib/trade.ts` | 2.5 | — | — | ✓ |
| `src/lib/backtest.ts` | 2.6 | — | — | ✓ |
| `src/lib/quiz.ts`, `src/lib/leaderboard.ts` | 2.7 | — | — | ✓ |
| **`src/store/AppStateContext.tsx`** | **2.8** | **4.3** | **4.3 → 2.8 (직접)** | **✓ [FIXED]** |
| `src/pages/HomeScreen.tsx` | 3.1 | 4.2, 4.4 | 4.2 → 4.1 → 3.1 / 4.4 → 4.2 | ✓ |
| `src/pages/MarketScreen.tsx` | 3.2 | 4.2, 4.3 | 4.2/4.3 → 4.1 → 3.2 | ✓ |
| `src/pages/TradeScreen.tsx` | 3.3 | — | — | ✓ |
| `src/pages/PortfolioScreen.tsx` | 3.4 | 3.5, 4.2, 4.4 | 3.5 → 3.4 / 4.2 → 4.1 → 3.4·3.5 | ✓ |
| `src/pages/BacktestSetupScreen.tsx` | 3.6 | 3.7 | 3.7 → 3.6 | ✓ |
| `src/pages/BacktestResultScreen.tsx` | 3.8 | 3.9, 4.2, 4.4 | 3.9 → 3.8 / 4.2 → 4.1 → 3.8·3.9 | ✓ |
| `src/pages/QuizScreen.tsx` | 3.10 | — | — | ✓ |
| `src/pages/QuizResultScreen.tsx` | 3.11 | 4.4 | 4.4 → 4.2 → 4.1 → 3.11 | ✓ |
| `src/pages/LeaderboardScreen.tsx` | 3.12 | 4.2 | 4.2 → 4.1 → 3.12 | ✓ |
| `src/App.tsx`, `src/components/AppTabBar.tsx` | 4.1 | — | — | ✓ |
| `.env.example` | 4.2 | — | — | ✓ |

**충돌 없음 / 미해결 의존 0건.**

---

## AC Coverage

- **Total ACs in SPEC**: **64** (F1~F8 × 8)
- **Covered by tasks**: **64**

| Feature | AC | 담당 Task |
|---|---|---|
| F1 | AC-1 | 2.2 |
| F1 | AC-2 | 2.1 |
| F1 | AC-3 | 2.4 |
| F1 | AC-4 | 2.3 |
| F1 | AC-5 | 2.3, 2.8 |
| F1 | AC-6 | 4.3 |
| F1 | AC-7 | 4.4 |
| F1 | AC-8 | 4.4 |
| F2 | AC-1 | 2.4, 3.1 |
| F2 | AC-2 | 2.4, 3.1 |
| F2 | AC-3 | 2.4 |
| F2 | AC-4 | 2.4, 2.8, 3.1 |
| F2 | AC-5 | 3.1 |
| F2 | AC-6 | 3.1 |
| F2 | AC-7 | 3.1 |
| F2 | AC-8 | 2.4 |
| F3 | AC-1 | 3.2 |
| F3 | AC-2 | 3.2 |
| F3 | AC-3 | 3.2 |
| F3 | AC-4 | 3.2 |
| F3 | AC-5 | 3.2 |
| F3 | AC-6 | 3.2, 4.3 |
| F3 | AC-7 | 3.2 |
| F3 | AC-8 | 4.2 |
| F4 | AC-1 | 2.5, 3.3 |
| F4 | AC-2 | 2.5, 3.3 |
| F4 | AC-3 | 2.5 |
| F4 | AC-4 | 3.3 |
| F4 | AC-5 | 3.3 |
| F4 | AC-6 | 3.3 |
| F4 | AC-7 | 3.3 |
| F4 | AC-8 | 3.3 |
| F5 | AC-1 | 3.4 |
| F5 | AC-2 | 3.4 |
| F5 | AC-3 | 3.4 |
| F5 | AC-4 | 3.5 |
| F5 | AC-5 | 3.5 |
| F5 | AC-6 | 3.4 |
| F5 | AC-7 | 2.3, 2.5 |
| F5 | AC-8 | 4.2 |
| F6 | AC-1 | 2.6, 3.7 |
| F6 | AC-2 | 3.6 |
| F6 | AC-3 | 3.6 |
| F6 | AC-4 | 3.6 |
| F6 | AC-5 | 3.7 |
| F6 | AC-6 | 3.7 |
| F6 | AC-7 | 3.7 |
| F6 | AC-8 | 3.6 |
| F7 | AC-1 | 2.6, 3.8 |
| F7 | AC-2 | 3.9 |
| F7 | AC-3 | 3.9 |
| F7 | AC-4 | 3.9 |
| F7 | AC-5 | 3.8, 4.1 |
| F7 | AC-6 | 3.9, 4.3 |
| F7 | AC-7 | 2.6, 3.9 |
| F7 | AC-8 | 4.2 |
| F8 | AC-1 | 2.7, 3.10, 3.11 |
| F8 | AC-2 | 3.10 |
| F8 | AC-3 | 3.10 |
| F8 | AC-4 | 2.7, 3.12 |
| F8 | AC-5 | 3.12 |
| F8 | AC-6 | 3.12 |
| F8 | AC-7 | 3.1, 4.1 |
| F8 | AC-8 | 3.12 |

- **Uncovered**: **0**

---

## 실행 순서 요약

```
1.1 (types)
 └─ 2.1 (instruments) ─ 2.2 (price engine) ─┐
 └─ 2.3 (storage) ─────────────────────────┤
                        2.4 (bootstrap/streak) ─┐
                        2.5 (trade engine) ─────┤
                        2.6 (backtest engine)   ├─ 2.8 (AppStateProvider)
                        2.7 (quiz/leaderboard)  ┘         │
                              ↓                           │
   3.1 홈 · 3.2 마켓 · 3.3 주문 · 3.4/3.5 포트폴리오 ·      │
   3.6/3.7 백테스트 구성 · 3.8/3.9 리포트 · 3.10/3.11 퀴즈 · │
   3.12 랭킹                                              │
                              ↓                           │
   4.1 라우팅 → 4.2 광고 배치 ─┐                            │
                4.3 로딩/성능 ─┼─────── 4.3은 2.8에도 직접 의존 ┘
                              └→ 4.4 컴플라이언스
```

**총 21 태스크** (Epic1: 1 / Epic2: 8 / Epic3: 12 / Epic4: 4). 각 태스크는 완료 시점에 `npx tsc --noEmit` 통과 + `vite build` 성공을 공통 DoD로 갖는다.

---

### 교차검증 결과 (수정 후)

| Check | Result |
|---|---|
| 1. PRD → SPEC | ✓ ALL CONSISTENT |
| 2. SPEC → TASK | ✓ 64/64 AC 커버, 0 gaps |
| 3. Task Ordering | ✓ Epic 2(data) → Epic 3(UI) → Epic 4(integration) |
| 4. File Conflicts | ✓ **RESOLVED** — 4.3에 2.8 직접 의존 추가 + 매트릭스로 전수 검증 |
| 5. PRD Achievable | ✓ ALL CONSISTENT |

**ALL CONSISTENT — 미해결 gap 0건.**