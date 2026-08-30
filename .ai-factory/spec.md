# SPEC — MockTradeArena

> 앱인토스 (Vite + React + TypeScript + TDS + React Router + localStorage)
> 기준 문서: PRD "MockTradeArena". 본 SPEC은 PRD에 명시된 사실만 확장하며, 확장 과정에서 필요한 가정은 **Assumptions**에 명시한다.

---

## Common Principles

**CP-1. 기술 스택 고정**
Vite + React + TypeScript, 모든 UI는 TDS(`@toss/tds-mobile`), 라우팅은 `react-router-dom`, 데이터는 `localStorage`. shadcn/ui, MUI, Ant Design, Chakra UI, Tailwind 여백 오버라이드 금지.

**CP-2. 서버 없음 / 외부 네트워크 호출 없음**
백엔드 서버, 외부 시세 API를 사용하지 않는다. 시세는 앱 번들에 포함된 **종목 마스터(정적 JSON)** + **결정적 가격 엔진(deterministic price engine)** 으로 생성한다. 따라서 외부 API 계약이 없으며 CORS 실패 경로가 존재하지 않는다.

**CP-3. 결정론(Determinism)**
동일한 `(symbol, date)` 입력에 대해 가격 엔진은 언제·어느 기기에서 호출해도 **동일한 정수 가격(원)** 을 반환한다. 백테스트 결과는 동일 프리셋·동일 기간에 대해 항상 동일하다.

**CP-4. 인증**
토스 앱이 세션을 자동 제공한다. 로그인 함수 호출 없음. 사용자 식별이 필요한 화면(랭킹)에서는 `getIsTossLoginIntegratedService()` 로 연동 여부만 확인한다.

**CP-5. 수익화**
- 배너: `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` — 콘텐츠 섹션 **사이 또는 하단**에만 배치, 콘텐츠와 겹치지 않음.
- 리워드: `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` — **백테스트 상세 리포트(MDD·샤프지수·연도별 수익률)** 게이팅 전용.
- IAP 미사용(PRD Monetization = ads).
- `grantPromotionReward` 미사용(MVP 범위 외). 사용 시 `amount ≤ 5000` 검증 필수.

**CP-6. 표현 계약(공통)**
- 모든 화면은 `ScreenScaffold`(템플릿 제공 페이지 골격)로 감싼다. raw `div` 골격 금지.
- 1차 액션은 `SubmitFooter`(하단 고정) 또는 `display="block"` TDS Button.
- 핵심 수치/결과는 TDS `Card`로 묶어 위계를 표현한다. 맨 `div` 나열 금지.
- 간격은 TDS `Spacing`(`size` 필수)만 사용. HEX 색상 하드코딩 금지 → `var(--tds-color-*)` 또는 TDS 컴포넌트.
- 모든 탭 가능한 요소의 터치 타깃 ≥ 44×44px.

**CP-7. 생성형 AI 미사용**
본 앱의 모든 산출물(백테스트 리포트, 투자성향 진단, 랭킹)은 **결정적 수식·룰 기반**이며 LLM/생성형 AI를 사용하지 않는다. 따라서 생성형 AI 고지 의무 대상이 아니다. 대신 **투자 모의훈련 고지**(CP-8)를 의무 표시한다.

**CP-8. 투자 고지**
모든 수익률·리포트 화면 하단에 "본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다." 문구를 고정 노출한다.

**CP-9. 시간 기준**
모든 날짜는 **KST(Asia/Seoul)** 기준 `YYYY-MM-DD` 문자열로 저장·비교한다.

**CP-10. 금액 규칙**
모든 금액은 `number`(원 단위 정수). 계산 중 소수는 `Math.floor`로 절사한다. 표시는 `toLocaleString('ko-KR')` + "원".

---

## Data Models

모든 키는 `mta:` 프리픽스 + 스키마 버전 관리(`mta:meta`의 `schemaVersion`).

### Instrument (정적 번들 데이터 — localStorage 저장 안 함)

```ts
type InstrumentType = 'STOCK' | 'ETF';

interface Instrument {
  symbol: string;        // 6자리 종목코드, 예: "005930"
  name: string;          // 예: "삼성전자"
  type: InstrumentType;
  sector: string;        // 예: "반도체"
  basePrice: number;     // 2016-01-01 기준 시가(원, 정수), 예: 52000
  annualDrift: number;   // 연 기대수익률, 예: 0.08
  annualVol: number;     // 연 변동성, 예: 0.24
}
```

- 파일: `src/data/instruments.ts` — **정확히 20개** 종목(주식 10 + ETF 10).
- 크기: 20 × 약 140B ≈ **2.8KB** (번들, localStorage 미사용).

### PricePoint (메모리 캐시 전용, 영속화 안 함)

```ts
interface PricePoint {
  date: string;   // "YYYY-MM-DD"
  close: number;  // 원 단위 정수, 최소 100
}
```

### Account

```ts
interface Account {
  cash: number;              // 보유 현금(원)
  lastGrantDate: string;     // 마지막 일일 지급일 "YYYY-MM-DD", 미지급 시 ""
  totalGranted: number;      // 누적 지급액(원)
  createdAt: string;         // ISO8601
}
```
- key: `mta:account` — 약 **120B**

### Position

```ts
interface Position {
  symbol: string;
  qty: number;        // 보유 수량, 정수 ≥ 1
  avgPrice: number;   // 평균 매입 단가(원, 정수)
}
type PositionMap = Record<string, Position>; // key = symbol
```
- key: `mta:positions` — 최대 20종목 × 약 70B ≈ **1.4KB**

### Trade

```ts
type TradeSide = 'BUY' | 'SELL';

interface Trade {
  id: string;          // crypto.randomUUID()
  symbol: string;
  name: string;
  side: TradeSide;
  qty: number;         // ≥ 1
  price: number;       // 체결가(원)
  fee: number;         // 수수료+세금 합계(원)
  amount: number;      // qty*price (원)
  tradedAt: string;    // ISO8601
}
```
- key: `mta:trades` — `Trade[]`, **최대 500건 유지(초과 시 오래된 것부터 삭제)**. 500 × 약 200B ≈ **100KB**

### StreakState

```ts
interface StreakState {
  currentStreak: number;    // 연속 출석 일수, ≥ 0
  longestStreak: number;
  lastCheckInDate: string;  // "YYYY-MM-DD"
  totalBonus: number;       // 누적 스트릭 보너스(원)
}
```
- key: `mta:streak` — 약 **110B**

### BacktestPreset

```ts
interface PresetItem {
  symbol: string;
  weight: number;   // 정수 퍼센트, 5 ~ 100
}

interface BacktestPreset {
  id: string;           // crypto.randomUUID()
  name: string;         // 1~20자
  items: PresetItem[];  // 1~5개, weight 합계 === 100
  years: 1 | 3 | 5 | 10;
  createdAt: string;    // ISO8601
}
```
- key: `mta:presets` — `BacktestPreset[]`, **최대 10개**. 10 × 약 300B ≈ **3KB**

### BacktestResult (계산 산출물, 마지막 1건만 캐시)

```ts
interface YearlyReturn { year: number; returnPct: number; }

interface BacktestResult {
  presetId: string;
  years: 1 | 3 | 5 | 10;
  startDate: string;          // "YYYY-MM-DD"
  endDate: string;            // "YYYY-MM-DD"
  initialAmount: 10000000;    // 고정 1,000만원
  finalAmount: number;        // 원
  totalReturnPct: number;     // 소수 2자리 반올림, 예: 43.27
  cagrPct: number;            // 소수 2자리
  mddPct: number;             // 음수, 소수 2자리, 예: -22.41
  sharpe: number;             // 소수 2자리
  volatilityPct: number;      // 연환산 변동성, 소수 2자리
  monthlyEquity: number[];    // 월말 평가금액 시계열 (years*12+1 개)
  yearly: YearlyReturn[];
  computedAt: string;         // ISO8601
}
```
- key: `mta:lastBacktest` — 최대 121개 숫자 시계열 ≈ **2KB**

### QuizResult

```ts
type RiskType = 'STABLE' | 'STABLE_GROWTH' | 'NEUTRAL' | 'ACTIVE' | 'AGGRESSIVE';

interface QuizResult {
  answers: number[];       // 길이 8, 각 값 1~4
  score: number;           // 8 ~ 32
  type: RiskType;
  recommendedSymbols: string[]; // 정확히 3개
  answeredAt: string;      // ISO8601
}
```
- key: `mta:quiz` — 약 **220B**

### LeaderboardEntry

```ts
interface LeaderboardEntry {
  id: string;            // "me" 또는 "bot-01"..."bot-49"
  nickname: string;      // 예: "불꽃개미"
  isMe: boolean;
  isFriend: boolean;
  totalAssetKrw: number; // 총 평가자산(원)
  returnPct: number;     // 소수 2자리
  streak: number;
}
```
- key: `mta:leaderboardSeed` — 봇 49명 시드(닉네임/기본자산/친구여부). 49 × 약 90B ≈ **4.5KB**
- "me" 항목은 저장하지 않고 매 렌더 시 계산한다.

### AppMeta

```ts
interface AppMeta {
  schemaVersion: 1;
  disclaimerSeen: boolean;      // 최초 진입 고지 확인 여부
  onboardedAt: string;          // ISO8601
  rewardUnlockedPresetIds: string[]; // 리워드 광고로 상세 리포트 해제된 프리셋 (최대 20개)
}
```
- key: `mta:meta` — 약 **900B**

### 총 용량 추산

| 키 | 크기 |
|---|---|
| `mta:account` | 0.12KB |
| `mta:positions` | 1.4KB |
| `mta:trades` | 100KB |
| `mta:streak` | 0.11KB |
| `mta:presets` | 3KB |
| `mta:lastBacktest` | 2KB |
| `mta:quiz` | 0.22KB |
| `mta:leaderboardSeed` | 4.5KB |
| `mta:meta` | 0.9KB |
| **합계** | **약 112KB (5MB 한도의 2.3%)** |

---

## Feature List

---

### F1. 데이터 레이어 & 결정적 시세 엔진

- **Description**: 종목 마스터 20개(주식 10 + ETF 10)를 번들 상수로 제공하고, `(symbol, date)` → 정수 가격을 반환하는 결정적 가격 엔진을 구현한다. localStorage 읽기/쓰기 래퍼(스키마 버전, JSON 파싱 실패 복구, QuotaExceeded 처리)와 최초 진입 시 계정 초기화를 담당한다. UI 없음 — 순수 로직 + 초기화 부트스트랩 계층이다.
- **Data**: `Instrument`, `PricePoint`, `Account`, `AppMeta`
- **API**: 없음 (CP-2 — 외부 네트워크 호출 없음)
- **Requirements**:
  - 가격 엔진: 시드 = `hash32(symbol + '|' + dayIndex)`, PRNG = mulberry32, 정규난수 = Box–Muller.
  - 일간 수익률 `r_t = annualDrift/252 + annualVol/Math.sqrt(252) * z_t`, `close_t = Math.max(100, Math.floor(close_{t-1} * (1 + r_t)))`, `close_0 = basePrice` (기준일 `2016-01-01`).
  - 월말 종가 시리즈는 일간 시리즈에서 각 월의 마지막 캘린더 일자를 샘플링한다.
  - 일간 시리즈는 세션 메모리에 심볼별 1회만 계산 후 캐시한다(localStorage 저장 금지).

- **AC-1 [U][P0]**: Scenario: 가격 엔진 결정성
  Given 종목 `{ symbol: "005930", basePrice: 52000, annualDrift: 0.08, annualVol: 0.24 }` 가 주어졌을 때
  When `getClose("005930", "2024-03-15")` 를 서로 다른 3회 호출
  Then 3회 모두 **동일한 정수값**을 반환하고, 반환값은 `Number.isInteger === true` 이며 `>= 100` 이다

- **AC-2 [U][P0]**: Scenario: 종목 마스터 무결성
  Given 앱이 로드되었을 때
  When `INSTRUMENTS` 배열을 조회
  Then 길이가 정확히 `20` 이고, `type === 'STOCK'` 이 10개, `type === 'ETF'` 가 10개이며, `symbol` 은 모두 6자리 숫자 문자열이고 중복이 없다

- **AC-3 [E][P0]**: Scenario: 최초 진입 시 계정 초기화
  Given `localStorage`에 `mta:account` 키가 없을 때
  When 앱을 실행
  Then `mta:account` 가 `{ cash: 1000000, lastGrantDate: <오늘 KST>, totalGranted: 1000000 }` 로 생성되고
  And `mta:meta` 가 `{ schemaVersion: 1, disclaimerSeen: false, rewardUnlockedPresetIds: [] }` 로 생성됨

- **AC-4 [W][P1]**: Scenario: 손상된 JSON 복구
  Given `localStorage.setItem("mta:positions", "{not-json")` 인 상태일 때
  When `loadPositions()` 호출
  Then 예외를 던지지 않고 `{}` 를 반환하고, `mta:positions` 를 `"{}"` 로 덮어쓰며, `console.error` 를 호출하지 않는다

- **AC-5 [W][P1]**: Scenario: 저장 용량 초과
  Given `localStorage.setItem` 이 `QuotaExceededError` 를 던지는 상태일 때
  When 거래 기록 저장을 시도
  Then `mta:trades` 배열의 오래된 100건을 삭제 후 1회 재시도하고
  And 재시도도 실패하면 TDS Toast에 `"저장 공간이 부족해요. 거래내역을 정리해주세요"` 를 표시하고 앱은 크래시하지 않는다

- **AC-6 [S][P1]**: Scenario: 시세 계산 중 로딩 상태
  Given 심볼 20개의 일간 시리즈가 아직 캐시되지 않은 상태일 때
  When 마켓 화면이 마운트
  Then 계산 완료 전까지 TDS Skeleton 20행이 표시되고, 계산은 **200ms 이내** 완료되며 완료 후 Skeleton이 제거됨

- **AC-7 [U][P0]**: Scenario: 콘솔 에러 0개 / 외부 호출 0건
  Given 프로덕션 빌드(`vite build`) 산출물을 실행했을 때
  When 홈 → 마켓 → 주문 → 포트폴리오 → 백테스트 → 랭킹 순으로 이동
  Then `console.error` 호출이 0회이고, 네트워크 요청(fetch/XHR) 중 광고 SDK 외 외부 도메인 요청이 0건이며 CORS 에러가 0건이다

- **AC-8 [W][P0]**: Scenario: 외부 도메인 이탈 금지
  Given 앱의 전체 소스 트리를 정적 검사했을 때
  When `window.open` 또는 `window.location.href = 'http'` 패턴을 탐색
  Then 매칭 결과가 0건이며, 앱 설치 유도 문구(`"설치"`, `"다운로드"`)를 포함한 UI 텍스트가 0건이다

---

### F2. 홈 대시보드 · 일일 가상자금 지급 · 출석 스트릭

- **Description**: 앱 진입 시 KST 날짜가 바뀌었으면 가상자금 100만원을 자동 지급하고 연속 출석 스트릭을 갱신한다. 홈에서는 총 평가자산(현금 + 보유종목 평가액)을 히어로 수치로 보여주고, 최근 30일 자산 추이 Sparkline과 각 기능(모의매매/백테스트/퀴즈/랭킹) 진입 카드를 제공한다. 최초 진입 시 모의투자 고지 다이얼로그를 1회 표시한다.
- **Data**: `Account`, `StreakState`, `PositionMap`, `AppMeta`
- **API**: 없음
- **Requirements**:
  - 일일 지급액: `1,000,000원`
  - 스트릭 보너스: `streak >= 7 → 500,000원`, `streak >= 5 → 300,000원`, `streak >= 3 → 100,000원`, 그 외 `0원`
  - 총 평가자산 = `cash + Σ(position.qty × getClose(symbol, 오늘))`

- **AC-1 [E][P0]**: Scenario: 날짜 변경 시 일일 자금 지급
  Given `mta:account = { cash: 250000, lastGrantDate: "2026-08-30", totalGranted: 3000000 }` 이고 오늘이 `2026-08-31`(KST)일 때
  When 홈 화면 진입
  Then `cash` 가 `1250000` 으로 갱신되고 `lastGrantDate` 가 `"2026-08-31"`, `totalGranted` 가 `4000000` 이 되며
  And TDS Toast에 `"오늘의 가상자금 1,000,000원이 지급됐어요"` 가 표시됨

- **AC-2 [E][P0]**: Scenario: 연속 출석 3일차 보너스
  Given `mta:streak = { currentStreak: 2, longestStreak: 4, lastCheckInDate: "2026-08-30", totalBonus: 0 }` 이고 오늘이 `2026-08-31` 일 때
  When 홈 화면 진입
  Then `currentStreak` 이 `3`, `totalBonus` 가 `100000` 이 되고 `cash` 에 일일지급 `1,000,000` + 보너스 `100,000` = `1,100,000` 이 가산되며
  And TDS BottomSheet에 `"3일 연속 출석! 보너스 100,000원"` 이 표시됨

- **AC-3 [E][P1]**: Scenario: 하루 건너뛰면 스트릭 초기화
  Given `mta:streak.lastCheckInDate = "2026-08-28"` 이고 오늘이 `2026-08-31` 일 때
  When 홈 화면 진입
  Then `currentStreak` 이 `1` 로 초기화되고 `longestStreak` 은 기존값을 유지하며 보너스는 `0원` 지급됨

- **AC-4 [S][P0]**: Scenario: 같은 날 재진입 시 중복 지급 방지
  Given `mta:account.lastGrantDate === "2026-08-31"` 이고 오늘이 `2026-08-31` 일 때
  When 홈 화면을 2회 연속 재진입
  Then `cash` 값이 변하지 않고 지급 Toast가 표시되지 않음

- **AC-5 [E][P0]**: Scenario: 최초 진입 모의투자 고지
  Given `mta:meta.disclaimerSeen === false` 일 때
  When 홈 화면 진입
  Then TDS AlertDialog에 `"본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다."` 가 표시되고
  And `"확인"` 버튼 탭 시 `mta:meta.disclaimerSeen = true` 로 저장되며 재진입 시 다시 표시되지 않음

- **AC-6 [S][P1]**: Scenario: 보유 종목 없는 빈 상태
  Given `mta:positions === {}` 일 때
  When 홈 화면 렌더
  Then `data-testid="home-holdings-empty"` 영역에 `Asset.ContentIcon` 과 `"아직 보유 종목이 없어요"` 텍스트, `"모의매매 시작하기"` TDS Button(`display="block"`)이 표시됨

- **AC-7 [U][P0]**: Scenario: 홈 레이아웃 계약
  Given 홈 화면이 렌더되었을 때
  Then 화면은 `ScreenScaffold` 로 감싸이고, `data-testid="home-asset-hero"` 인 `SummaryHero` 1개(총 평가자산 CountUp, 타이포 t2)와
  And `data-testid="home-trend-sparkline"` 인 `Sparkline` 1개, `data-testid="home-menu-card"` 인 `Card` 4개(모의매매/백테스트/투자성향/랭킹)가 존재하며
  And 모든 카드의 클릭 영역 높이가 `>= 44px` 이다

- **AC-8 [W][P1]**: Scenario: 시스템 시계 역행
  Given `mta:account.lastGrantDate = "2026-09-05"` 이고 기기 시각이 `2026-08-31` 로 되돌아간 상태일 때
  When 홈 화면 진입
  Then 자금이 지급되지 않고 `cash` 가 변하지 않으며 `lastGrantDate` 도 변경되지 않는다

---

### F3. 마켓 목록 & 종목 상세

- **Description**: 20개 국내 대표종목·ETF를 리스트로 보여주고, 전일 대비 등락률과 60일 Sparkline을 제공한다. 상단 TDS Tab으로 전체/주식/ETF를 전환하고, TextField로 종목명·코드 검색을 지원한다. 행을 탭하면 주문 화면으로 이동한다.
- **Data**: `Instrument`, `PricePoint`, `PositionMap`
- **API**: 없음
- **Requirements**:
  - 등락률 = `(close(today) - close(어제)) / close(어제) * 100`, 소수 2자리 반올림
  - 목록은 20행 고정 → 가상 스크롤 불필요, 네이티브 세로 스크롤 사용(오버스크롤 바운스 유지)

- **AC-1 [U][P0]**: Scenario: 마켓 목록 렌더
  Given 마켓 화면에 진입했을 때
  Then TDS `ListRow` 20개가 렌더되고, 각 행은 종목명·6자리 코드·현재가(원)·등락률(`+1.24%` 형식)을 포함하며 행 높이가 `>= 44px` 이다

- **AC-2 [E][P0]**: Scenario: 탭 필터 전환
  Given 마켓 화면에서 TDS Tab이 `"전체"` 일 때
  When `"ETF"` 탭을 탭
  Then `type === 'ETF'` 인 10개 행만 표시되고 `data-testid="market-list"` 의 자식 수가 `10` 이 됨

- **AC-3 [E][P0]**: Scenario: 종목 검색
  Given 마켓 화면에서 TDS TextField에 포커스가 있을 때
  When `"삼성"` 을 입력
  Then 종목명에 `"삼성"` 을 포함하는 행만 표시되고(예: `삼성전자`, `삼성바이오로직스`) 그 외 행은 숨겨짐

- **AC-4 [W][P1]**: Scenario: 검색 결과 없음
  Given 마켓 화면에서 검색어가 `"zzzz"` 일 때
  Then `data-testid="market-empty"` 에 `Asset.ContentIcon` 과 `"검색 결과가 없어요"` 가 표시되고 목록 행은 0개임

- **AC-5 [E][P1]**: Scenario: 모바일 키보드 처리
  Given 마켓 화면 검색 TextField에 포커스가 있을 때
  When 가상 키보드가 올라옴
  Then 목록 컨테이너 하단 패딩이 키보드 높이만큼 확보되어 마지막 행이 가려지지 않고
  And 목록을 스크롤하면 키보드가 dismiss되며 입력값은 유지됨

- **AC-6 [S][P1]**: Scenario: 시세 계산 중
  Given 가격 캐시가 비어 있는 상태로 마켓 화면에 진입했을 때
  Then 계산 완료 전 TDS Skeleton 20행이 표시되고, 완료 후 실제 데이터로 교체됨

- **AC-7 [E][P0]**: Scenario: 주문 화면 이동
  Given 마켓 목록에서 `삼성전자(005930)` 행이 보일 때
  When 해당 행을 탭
  Then `navigate('/trade/005930', { state: { symbol: "005930", from: "market" } })` 가 호출됨

- **AC-8 [U][P2]**: Scenario: 광고 배치
  Given 마켓 화면이 렌더되었을 때
  Then `<AdSlot />` 이 목록 **하단**(마지막 행 아래)에 1개 배치되고, 목록 행 위에 오버레이되지 않으며 `position: fixed` 를 사용하지 않는다

---

### F4. 모의매매 주문 (매수/매도 체결)

- **Description**: 선택한 종목을 현재가로 즉시 체결하는 시장가 주문 화면이다. 매수/매도 세그먼트, 수량 입력, 예상 체결금액·수수료 미리보기를 제공하고 확인 시 현금·보유수량·평균단가를 갱신하며 거래내역에 기록한다. 잔액 부족·보유수량 초과 등 실패 조건을 명시적으로 차단한다.
- **Data**: `Account`, `PositionMap`, `Trade`, `Instrument`
- **API**: 없음
- **Requirements**:
  - 매수 수수료 = `Math.floor(qty * price * 0.00015)`
  - 매도 수수료 = `Math.floor(qty * price * 0.00015) + Math.floor(qty * price * 0.0018)` (거래세 포함)
  - 매수 총 차감 = `qty*price + 매수수수료`, 매도 총 입금 = `qty*price - 매도수수료`
  - 평균단가 갱신 = `Math.floor((기존qty*기존avg + qty*price) / (기존qty + qty))`

- **AC-1 [E][P0]**: Scenario: 매수 체결 성공
  Given `mta:account.cash = 1000000`, `mta:positions = {}` 이고 `getClose("005930", 오늘) === 70000` 일 때
  When 주문 화면에서 `{ side: "BUY", symbol: "005930", qty: 10 }` 제출
  Then `cash` 가 `1000000 - 700000 - 105 = 299895` 가 되고
  And `mta:positions["005930"] = { symbol: "005930", qty: 10, avgPrice: 70000 }` 로 저장되며
  And `mta:trades` 에 `side: "BUY", qty: 10, price: 70000, fee: 105, amount: 700000` 항목이 추가되고
  And TDS Toast에 `"삼성전자 10주 매수 체결"` 이 표시된 뒤 `navigate('/portfolio')` 로 이동

- **AC-2 [E][P0]**: Scenario: 매도 체결 성공
  Given `mta:positions["005930"] = { qty: 10, avgPrice: 60000 }`, `cash = 0`, 현재가 `70000` 일 때
  When `{ side: "SELL", symbol: "005930", qty: 10 }` 제출
  Then 수수료가 `105 + 1260 = 1365`, `cash` 가 `700000 - 1365 = 698635` 가 되고
  And `mta:positions` 에서 `"005930"` 키가 **삭제**되며(qty 0), 거래내역에 `side: "SELL"` 1건이 추가됨

- **AC-3 [E][P0]**: Scenario: 평균단가 재계산
  Given `mta:positions["069500"] = { qty: 10, avgPrice: 30000 }` 이고 현재가가 `40000` 일 때
  When `{ side: "BUY", symbol: "069500", qty: 10 }` 제출
  Then `qty === 20` 이고 `avgPrice === 35000` 이 됨

- **AC-4 [W][P1]**: Scenario: 잔액 부족 거부
  Given `cash = 100000`, 현재가 `70000` 일 때
  When `{ side: "BUY", qty: 5 }` 제출 (필요금액 350,052원)
  Then 체결되지 않고 TDS TextField 하단에 `"잔액이 부족해요"` 가 표시되며 `mta:account`, `mta:positions`, `mta:trades` 가 변경되지 않음

- **AC-5 [W][P1]**: Scenario: 보유수량 초과 매도 거부
  Given `mta:positions["005930"].qty === 3` 일 때
  When `{ side: "SELL", qty: 5 }` 제출
  Then 체결되지 않고 `"보유 수량은 3주예요"` 가 표시됨

- **AC-6 [W][P1]**: Scenario: 잘못된 수량 입력 거부
  Given 주문 화면에서 수량 입력이 `0` 또는 `""` 또는 `"1.5"` 일 때
  When 제출 버튼을 탭
  Then 체결되지 않고 `"수량을 1주 이상 입력해주세요"` 가 표시되며, 제출 버튼은 `disabled` 상태를 유지함

- **AC-7 [S][P1]**: Scenario: 미보유 종목 매도 탭
  Given `mta:positions` 에 `"035720"` 이 없는 상태로 `/trade/035720` 에 진입했을 때
  When `"매도"` 세그먼트를 선택
  Then 수량 입력이 `disabled` 되고 `"보유 중인 수량이 없어요"` 안내가 표시됨

- **AC-8 [U][P0]**: Scenario: 주문 화면 레이아웃/키보드 계약
  Given 주문 화면이 렌더되었을 때
  Then 화면은 `ScreenScaffold` 로 감싸이고 1차 액션은 `SubmitFooter` 하단 고정 버튼이며
  And `data-testid="order-preview-card"` 인 `Card` 1개에 예상 체결금액·수수료·주문 후 잔액이 표시되고
  And 수량 TextField는 `inputMode="numeric"` 이며 포커스 시 `SubmitFooter` 가 키보드 위로 밀려 올라가 가려지지 않는다

---

### F5. 포트폴리오 & 거래내역

- **Description**: 보유 종목별 수량·평균단가·현재가·평가손익과 계좌 전체 손익률을 보여준다. 종목별 비중은 MiniBar로 시각화하고, TDS Tab으로 "보유종목"과 "거래내역"을 전환한다. 거래내역은 최신순으로 정렬하며 100건 초과 시 가상 스크롤을 사용한다.
- **Data**: `PositionMap`, `Trade`, `Account`, `Instrument`
- **API**: 없음
- **Requirements**:
  - 종목 평가손익 = `qty * (현재가 - avgPrice)`, 손익률 = `(현재가 - avgPrice)/avgPrice*100` (소수 2자리)
  - 총 평가자산 = `cash + Σ(qty × 현재가)`
  - 비중(%) = `qty*현재가 / (총 평가자산) * 100`

- **AC-1 [U][P0]**: Scenario: 보유 종목 손익 계산
  Given `mta:positions["005930"] = { qty: 10, avgPrice: 60000 }` 이고 현재가가 `70000` 일 때
  When 포트폴리오 화면 렌더
  Then 해당 `ListRow` 에 평가금액 `700,000원`, 평가손익 `+100,000원`, 손익률 `+16.67%` 가 표시됨

- **AC-2 [U][P0]**: Scenario: 포트폴리오 레이아웃 계약
  Given 포트폴리오 화면이 렌더되었을 때
  Then 화면은 `ScreenScaffold` 로 감싸이고 `data-testid="portfolio-hero"` 인 `SummaryHero` 1개(총 평가자산 CountUp, 타이포 t2 + 손익률 배지)와
  And 보유 종목마다 `data-testid="portfolio-position-card"` 인 `Card` 가 1개씩 존재하며 각 Card 안에 `MiniBar`(비중) 1개가 포함됨

- **AC-3 [S][P1]**: Scenario: 보유 종목 빈 상태
  Given `mta:positions === {}` 일 때
  When `"보유종목"` 탭을 렌더
  Then `data-testid="portfolio-empty"` 에 `Asset.ContentIcon` 과 `"보유 중인 종목이 없어요"`, `"마켓 둘러보기"` TDS Button(`display="block"`)이 표시됨

- **AC-4 [S][P1]**: Scenario: 거래내역 빈 상태
  Given `mta:trades === []` 일 때
  When `"거래내역"` 탭을 탭
  Then `"아직 거래 내역이 없어요"` 가 표시되고 리스트 행이 0개임

- **AC-5 [S][P0]**: Scenario: 긴 거래내역 가상 스크롤
  Given `mta:trades` 에 `120` 건이 있을 때
  When `"거래내역"` 탭을 렌더
  Then 초기 DOM에 렌더된 행 수가 `<= 30` 이고, 스크롤에 따라 행이 추가 렌더되며 전체 120건에 모두 도달 가능함

- **AC-6 [W][P1]**: Scenario: 상장 데이터 없는 심볼 방어
  Given `mta:positions` 에 마스터에 없는 `"999999"` 항목이 존재할 때
  When 포트폴리오 화면 렌더
  Then 해당 항목은 목록에서 제외되고 총 평가자산 계산에도 포함되지 않으며, `console.error` 없이 렌더가 완료됨

- **AC-7 [E][P1]**: Scenario: 거래내역 500건 상한
  Given `mta:trades` 가 `500` 건일 때
  When 신규 매수 1건이 체결
  Then 가장 오래된 1건이 삭제되어 배열 길이가 `500` 을 유지하고 신규 항목이 배열 최신 위치에 존재함

- **AC-8 [U][P2]**: Scenario: 광고 배치
  Given 포트폴리오 화면이 렌더되었을 때
  Then `<AdSlot />` 이 보유종목 섹션과 거래내역 섹션 **사이**에 1개 배치되고 어떤 카드와도 겹치지 않음

---

### F6. 포트폴리오 백테스트 구성 & 실행

- **Description**: 최대 5개 종목과 비중(합계 100%)을 선택하고 기간(1/3/5/10년)을 지정해 과거 데이터로 시뮬레이션을 실행한다. 초기 투자금 1,000만원을 기준으로 월말 리밸런싱 없이 매수 후 보유(buy & hold) 방식으로 월별 평가금액 시계열을 계산한다. 구성은 프리셋으로 최대 10개까지 저장할 수 있다.
- **Data**: `BacktestPreset`, `BacktestResult`, `Instrument`, `PricePoint`
- **API**: 없음
- **Requirements**:
  - `initialAmount = 10,000,000원` 고정, 종목별 배분 = `Math.floor(10000000 * weight / 100)`
  - 시작 시점 매수 수량(소수 허용) = `배분금액 / close(startDate)`
  - `monthlyEquity[i] = Σ(수량_j × monthClose_j[i])`, 정수 절사
  - 기간 시작일 = `endDate` 기준 `years` 년 전 같은 달의 말일, `endDate` = 직전 월말

- **AC-1 [E][P0]**: Scenario: 백테스트 실행 성공
  Given 백테스트 구성 화면에서 `{ items: [{symbol:"005930",weight:60},{symbol:"069500",weight:40}], years: 5, name: "코어2종" }` 이 입력되었을 때
  When `"백테스트 실행"` 버튼 탭
  Then `monthlyEquity.length === 61` 인 `BacktestResult` 가 계산되어 `mta:lastBacktest` 에 저장되고
  And `navigate('/backtest/result', { state: { presetId: string, years: 5 } })` 로 이동함

- **AC-2 [W][P1]**: Scenario: 비중 합계 불일치 거부
  Given 구성이 `[{symbol:"005930",weight:60},{symbol:"069500",weight:30}]` (합계 90)일 때
  When 실행 버튼을 탭
  Then 실행되지 않고 `"비중 합계가 100%가 되어야 해요 (현재 90%)"` 가 표시되며 실행 버튼은 `disabled` 상태임

- **AC-3 [W][P1]**: Scenario: 종목 6개 선택 차단
  Given 이미 5개 종목이 선택된 상태일 때
  When 6번째 종목을 탭
  Then 선택되지 않고 TDS Toast에 `"종목은 최대 5개까지 담을 수 있어요"` 가 표시됨

- **AC-4 [W][P1]**: Scenario: 종목 0개 실행 차단
  Given `items.length === 0` 일 때
  When 실행 버튼을 탭
  Then 실행되지 않고 `"종목을 1개 이상 선택해주세요"` 가 표시됨

- **AC-5 [S][P1]**: Scenario: 계산 중 로딩 상태
  Given 실행 버튼을 탭한 직후일 때
  When 계산이 진행 중
  Then `SubmitFooter` 버튼이 `loading` 상태로 전환되어 `disabled` 되고, 중복 탭해도 계산이 1회만 수행되며 **1,000ms 이내** 결과 화면으로 전환됨

- **AC-6 [E][P0]**: Scenario: 프리셋 저장
  Given 유효한 구성 `{ name: "코어2종", items: [...], years: 5 }` 일 때
  When `"프리셋 저장"` 을 탭
  Then `mta:presets` 배열에 항목이 추가되고 Toast `"프리셋이 저장됐어요"` 가 표시됨

- **AC-7 [W][P1]**: Scenario: 프리셋 11개 저장 차단
  Given `mta:presets.length === 10` 일 때
  When `"프리셋 저장"` 을 탭
  Then 저장되지 않고 `"프리셋은 최대 10개까지 저장할 수 있어요"` 가 표시됨

- **AC-8 [U][P0]**: Scenario: 구성 화면 레이아웃 계약
  Given 백테스트 구성 화면이 렌더되었을 때
  Then 화면은 `ScreenScaffold` 로 감싸이고, 종목 선택은 TDS `Chip` 20개, 기간 선택은 TDS `Tab` 4개(`1년/3년/5년/10년`)이며
  And `data-testid="weight-sum-card"` 인 `Card` 1개에 현재 비중 합계(`60%` 형식)와 `MiniBar` 가 표시되고
  And 실행 버튼은 `SubmitFooter` 하단 고정, 각 Chip의 터치 타깃은 `>= 44px` 이다

---

### F7. 백테스트 리포트 (리워드 광고 게이팅)

- **Description**: 백테스트 결과 화면은 무료 요약(총 수익률·최종 평가금액·자산 추이 Sparkline)을 먼저 보여주고, 상세 지표(CAGR·MDD·샤프지수·연도별 수익률)는 `TossRewardAd` 로 게이팅한다. 광고 시청을 완료한 프리셋 ID는 `mta:meta.rewardUnlockedPresetIds` 에 저장되어 재진입 시 다시 광고를 보지 않는다.
- **Data**: `BacktestResult`, `BacktestPreset`, `AppMeta`
- **API**: 없음
- **Requirements**:
  - `totalReturnPct = (finalAmount - 10000000) / 10000000 * 100`
  - `cagrPct = ((finalAmount/10000000) ** (1/years) - 1) * 100`
  - `mddPct = min over i of ((equity[i] - runningMax[i]) / runningMax[i]) * 100` (음수)
  - `sharpe = (연환산 월수익률 평균 - 0.03) / 연환산 월수익률 표준편차`, 무위험수익률 `3.0%/년` 고정
  - 모든 지표는 소수 2자리 반올림

- **AC-1 [U][P0]**: Scenario: 무료 요약 표시
  Given `location.state = { presetId: "p1", years: 5 }` 이고 `mta:lastBacktest.finalAmount === 14327000` 일 때
  When 결과 화면 렌더
  Then `data-testid="summary-hero"` 에 최종 평가금액 `14,327,000원` 이 CountUp으로 표시되고 총 수익률 `+43.27%` 배지가 노출되며
  And `data-testid="equity-sparkline"` 인 `Sparkline` 1개가 `monthlyEquity` 61개 점을 렌더함

- **AC-2 [E][P0]**: Scenario: 리워드 광고 시청 후 상세 리포트 해제
  Given `mta:meta.rewardUnlockedPresetIds` 에 `"p1"` 이 없을 때
  When `"상세 리포트 보기"` 버튼을 탭하고 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 광고 시청을 완료
  Then CAGR·MDD·샤프지수·연도별 수익률 카드가 표시되고
  And `mta:meta.rewardUnlockedPresetIds` 에 `"p1"` 이 추가됨

- **AC-3 [S][P0]**: Scenario: 이미 해제된 프리셋 재진입
  Given `mta:meta.rewardUnlockedPresetIds` 가 `["p1"]` 일 때
  When `presetId: "p1"` 로 결과 화면에 재진입
  Then 광고 없이 상세 리포트가 즉시 표시되고 `"상세 리포트 보기"` 버튼은 렌더되지 않음

- **AC-4 [W][P1]**: Scenario: 광고 로드 실패
  Given 광고 로드가 실패했을 때
  When `"상세 리포트 보기"` 를 탭
  Then TDS Toast에 `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"` 가 표시되고, 상세 리포트는 잠금 상태를 유지하며 `console.error` 를 호출하지 않음

- **AC-5 [W][P1]**: Scenario: state 없이 직접 진입
  Given `location.state === null` 인 상태로 `/backtest/result` 에 직접 진입했을 때
  When 화면이 마운트
  Then `mta:lastBacktest` 가 있으면 그 결과를 렌더하고, 없으면 `"먼저 백테스트를 실행해주세요"` 와 `"백테스트 하러 가기"` 버튼이 표시되며 크래시하지 않음

- **AC-6 [S][P1]**: Scenario: 지표 계산 로딩
  Given 결과 화면 마운트 직후 상세 지표 계산이 진행 중일 때
  Then 상세 카드 자리에 TDS Skeleton 4개가 표시되고 계산 완료 후 실제 값으로 교체됨

- **AC-7 [U][P0]**: Scenario: 결과 화면 레이아웃 계약
  Given 상세 리포트가 해제된 상태로 결과 화면이 렌더되었을 때
  Then `data-testid="metric-card"` 인 `Card` 가 정확히 `4` 개(CAGR / MDD / 샤프지수 / 연변동성) 존재하고
  And 각 Card의 핵심 값은 타이포 `t2~t3` 로 강조되며 MDD 값에는 하락을 나타내는 배지가 부착되고
  And `data-testid="yearly-bar"` 인 `MiniBar` 가 연도 수만큼 렌더됨

- **AC-8 [U][P0]**: Scenario: 투자 고지 및 광고 배치
  Given 결과 화면이 렌더되었을 때
  Then 화면 최하단에 `"본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다."` 문구가 표시되고
  And `<AdSlot />` 이 상세 리포트 카드 섹션 **아래**, 고지 문구 **위**에 1개 배치되어 어떤 카드도 가리지 않음

---

### F8. 투자성향 진단 퀴즈 & 랭킹 리더보드

- **Description**: 8문항 4지선다 퀴즈로 투자성향(안정형~공격투자형 5단계)을 룰 기반으로 판정하고 성향별 추천 종목 3개를 제시한다. 리더보드는 시드로 생성된 봇 49명과 사용자 본인의 총 평가자산을 비교해 전체/친구 탭으로 순위를 보여준다.
- **Data**: `QuizResult`, `LeaderboardEntry`, `Account`, `PositionMap`
- **API**: 없음
- **Requirements**:
  - 점수 = 8문항 선택값(1~4) 합계, 범위 8~32
  - 판정: `8~12 STABLE(안정형)`, `13~17 STABLE_GROWTH(안정추구형)`, `18~22 NEUTRAL(위험중립형)`, `23~27 ACTIVE(적극투자형)`, `28~32 AGGRESSIVE(공격투자형)`
  - 추천 종목: 성향별 고정 매핑 3개 (룰 기반, 생성형 AI 미사용)
  - 랭킹 정렬: `totalAssetKrw` 내림차순, 동점 시 `nickname` 오름차순

- **AC-1 [E][P0]**: Scenario: 퀴즈 판정 성공
  Given 퀴즈 8문항에 `[4,4,3,4,3,4,4,4]` (합계 30)로 응답했을 때
  When 마지막 문항 응답 후 `"결과 보기"` 탭
  Then `mta:quiz = { score: 30, type: "AGGRESSIVE", recommendedSymbols: [3개], answers: [4,4,3,4,3,4,4,4] }` 로 저장되고
  And `navigate('/quiz/result', { state: { score: 30, type: "AGGRESSIVE" } })` 로 이동해 `"공격투자형"` 과 추천 종목 3개 `Card` 가 표시됨

- **AC-2 [W][P1]**: Scenario: 미응답 문항 진행 차단
  Given 3번 문항이 미응답 상태일 때
  When `"다음"` 버튼을 탭
  Then 다음 문항으로 이동하지 않고 `"답변을 선택해주세요"` 가 표시되며 버튼은 `disabled` 상태를 유지함

- **AC-3 [E][P1]**: Scenario: 이전 문항 수정
  Given 5번 문항 화면일 때
  When TDS Top의 뒤로 버튼을 탭
  Then 4번 문항으로 이동하며 기존 선택값이 선택 상태로 복원됨

- **AC-4 [U][P0]**: Scenario: 랭킹 계산 및 내 위치 표시
  Given 봇 49명 시드가 존재하고 사용자의 총 평가자산이 `3,200,000원` 일 때
  When `"전체"` 랭킹 탭을 렌더
  Then 총 50개 항목이 `totalAssetKrw` 내림차순으로 정렬되고
  And `isMe === true` 인 행이 `data-testid="leaderboard-me-row"` 로 강조 표시되며 화면 하단에 고정 노출됨

- **AC-5 [S][P1]**: Scenario: 친구 랭킹 빈 상태
  Given 시드에 `isFriend === true` 인 항목이 0개일 때
  When `"친구"` 탭을 탭
  Then `data-testid="leaderboard-friend-empty"` 에 `Asset.ContentIcon` 과 `"아직 함께하는 친구가 없어요"` 가 표시됨

- **AC-6 [W][P1]**: Scenario: 토스 로그인 미연동
  Given `getIsTossLoginIntegratedService()` 가 `false` 를 반환할 때
  When 랭킹 화면에 진입
  Then 봇 49명 랭킹은 정상 표시되고 내 순위 행에는 닉네임 대신 `"나"` 가 표시되며 에러 화면이나 `console.error` 가 발생하지 않음

- **AC-7 [S][P1]**: Scenario: 퀴즈 미응시 상태의 홈 카드
  Given `mta:quiz` 가 없을 때
  When 홈의 투자성향 카드를 렌더
  Then `"투자성향 진단하기"` 라벨이 표시되고, 응시 후에는 `"공격투자형"` 등 판정 결과 라벨로 교체됨

- **AC-8 [U][P0]**: Scenario: 랭킹 화면 레이아웃 계약
  Given 랭킹 화면이 렌더되었을 때
  Then 화면은 `ScreenScaffold` 로 감싸이고 상단에 `data-testid="rank-hero"` 인 `SummaryHero`(내 순위 CountUp, 타이포 t2)가 존재하며
  And 순위 목록은 TDS `ListRow` 로 렌더되고 각 행 높이 `>= 44px`, 50행 이상일 경우 가상 스크롤을 사용함

---

## Screen Definitions

### S1. 홈 — `/`

- **TDS 컴포넌트**: `Top`(타이틀 "MockTradeArena"), `Card`(메뉴 4개 + 스트릭), `ListRow`(보유 요약), `Button`(display="block"), `AlertDialog`(모의투자 고지), `BottomSheet`(스트릭 보너스), `Toast`(자금 지급), `Spacing`, `Paragraph.Text`
- **템플릿 컴포넌트**: `ScreenScaffold`, `SummaryHero`, `Sparkline`, `Asset.ContentIcon`, `FloatingTabBar`, `AdSlot`
- **Layout/Presentation 계약**:
  - `ScreenScaffold` 필수
  - `data-testid="home-asset-hero"` — `SummaryHero`, 총 평가자산 CountUp, 타이포 t2, 손익률 배지
  - `data-testid="home-trend-sparkline"` — 최근 30일 자산 추이 `Sparkline`
  - `data-testid="home-menu-card"` — `Card` 4개(모의매매/백테스트/투자성향/랭킹)
  - `AdSlot` 은 메뉴 카드 섹션 아래, `FloatingTabBar` 위
- **상태**: Loading = Hero/Sparkline `Skeleton`; Empty = `home-holdings-empty`(ContentIcon + "아직 보유 종목이 없어요"); Error = 저장소 복구 실패 시 `"데이터를 불러오지 못했어요"` + `"다시 시도"` Button
- **터치**: 메뉴 카드 4개 각 높이 ≥ 72px, `FloatingTabBar` 아이템 ≥ 44px
- **Navigation 계약**
  - Outgoing: 모의매매 카드 → `navigate('/market')` (state 없음)
  - Outgoing: 백테스트 카드 → `navigate('/backtest')` (state 없음)
  - Outgoing: 투자성향 카드 → `navigate('/quiz')` (state 없음)
  - Outgoing: 랭킹 카드 → `navigate('/leaderboard')` (state 없음)
  - Outgoing: 보유 요약 → `navigate('/portfolio')` (state 없음)
  - Incoming: `location.state = null` (항상 무상태 진입)

### S2. 마켓 — `/market`

- **TDS 컴포넌트**: `Top`, `Tab`(전체/주식/ETF), `TextField`(검색, `inputMode="text"`), `ListRow`(종목행), `Chip`, `Spacing`, `Paragraph.Text`
- **템플릿 컴포넌트**: `ScreenScaffold`, `Sparkline`(행 내 60일 미니), `Asset.ContentIcon`, `AdSlot`, `FloatingTabBar`
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, `data-testid="market-list"` 컨테이너, 행마다 우측 등락률 배지(`+/-` 부호 포함)
- **상태**: Loading = `Skeleton` 20행; Empty = `data-testid="market-empty"`; Error = 없음(로컬 계산)
- **스크롤**: 20행 고정 → 네이티브 세로 스크롤. 검색 결과 100행 초과 가능성 없음(마스터 20개 상한)
- **키보드**: TextField 포커스 시 목록 하단 패딩 = 키보드 높이, 스크롤 시 dismiss, 입력값 유지
- **터치**: `ListRow` 높이 ≥ 56px, Tab 아이템 ≥ 44px
- **Navigation 계약**
  - Outgoing: 종목 행 탭 → `navigate('/trade/:symbol', { state: { symbol: string; from: 'market' } })`
  - Incoming: `location.state = null | { from: 'portfolio' }`

### S3. 주문 — `/trade/:symbol`

- **TDS 컴포넌트**: `Top`(뒤로), `Tab` 또는 세그먼트(매수/매도), `TextField`(수량, `inputMode="numeric"`), `Card`(주문 미리보기), `Button`, `Toast`, `AlertDialog`(체결 확인), `Spacing`
- **템플릿 컴포넌트**: `ScreenScaffold`, `SubmitFooter`
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, 1차 액션은 `SubmitFooter` 하단 고정 버튼(`"매수하기"` / `"매도하기"`), `data-testid="order-preview-card"` 인 `Card` 1개(예상 체결금액/수수료/주문 후 잔액, 총액은 타이포 t3 강조)
- **상태**: Loading = 체결 처리 중 `SubmitFooter` 버튼 `loading` + `disabled`; Empty = 매도 탭에서 보유 0주 시 수량 입력 `disabled` + `"보유 중인 수량이 없어요"`; Error = 필드 하단 `"잔액이 부족해요"` / `"보유 수량은 N주예요"` / `"수량을 1주 이상 입력해주세요"`
- **키보드**: 숫자 키패드, 포커스 시 `SubmitFooter` 가 키보드 위로 이동, `+10 / +100 / 최대` Chip으로 키보드 없이 입력 가능
- **터치**: 세그먼트·Chip·Footer 버튼 모두 ≥ 44px
- **Navigation 계약**
  - Incoming: `location.state = { symbol: string; from: 'market' | 'portfolio' } | null` (null이면 `useParams().symbol` 사용)
  - Outgoing: 체결 성공 → `navigate('/portfolio', { state: { justTradedSymbol: string } })`
  - Outgoing: 뒤로 → `navigate(-1)`

### S4. 포트폴리오 — `/portfolio`

- **TDS 컴포넌트**: `Top`, `Tab`(보유종목/거래내역), `ListRow`, `Card`, `Chip`, `Button`, `Spacing`, `Paragraph.Text`
- **템플릿 컴포넌트**: `ScreenScaffold`, `SummaryHero`, `MiniBar`, `Asset.ContentIcon`, `AdSlot`, `FloatingTabBar`
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, `data-testid="portfolio-hero"` `SummaryHero`(총 평가자산 CountUp t2 + 손익률 배지), 보유 종목마다 `data-testid="portfolio-position-card"` `Card`(내부에 비중 `MiniBar` 1개)
- **상태**: Loading = Hero + 카드 3개 `Skeleton`; Empty = `portfolio-empty` / 거래내역 `"아직 거래 내역이 없어요"`; Error = 마스터 미존재 심볼은 필터링(무음 처리)
- **스크롤**: 거래내역 100건 초과 시 가상 스크롤(초기 렌더 ≤ 30행)
- **터치**: Tab·ListRow ≥ 44px
- **Navigation 계약**
  - Incoming: `location.state = { justTradedSymbol: string } | null`
  - Outgoing: 보유 종목 카드 탭 → `navigate('/trade/:symbol', { state: { symbol: string; from: 'portfolio' } })`
  - Outgoing: `"마켓 둘러보기"` → `navigate('/market', { state: { from: 'portfolio' } })`

### S5. 백테스트 구성 — `/backtest`

- **TDS 컴포넌트**: `Top`, `Chip`(종목 20개 선택), `Tab`(1년/3년/5년/10년), `TextField`(프리셋 이름, 비중 입력 `inputMode="numeric"`), `Card`(비중 합계), `ListRow`(저장된 프리셋), `Button`, `Toast`, `Spacing`
- **템플릿 컴포넌트**: `ScreenScaffold`, `SubmitFooter`, `MiniBar`, `Asset.ContentIcon`
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, `data-testid="weight-sum-card"` `Card` 1개(합계 % 타이포 t3 + `MiniBar`), 1차 액션 `"백테스트 실행"` 은 `SubmitFooter` 하단 고정
- **상태**: Loading = 실행 중 `SubmitFooter` `loading` + `disabled`(중복 실행 차단); Empty = 저장된 프리셋 0개 시 `Asset.ContentIcon` + `"저장된 프리셋이 없어요"`; Error = `"비중 합계가 100%가 되어야 해요 (현재 N%)"`, `"종목을 1개 이상 선택해주세요"`, `"종목은 최대 5개까지 담을 수 있어요"`, `"프리셋은 최대 10개까지 저장할 수 있어요"`
- **키보드**: 비중/이름 입력 포커스 시 `SubmitFooter` 가 키보드 위로 이동, 비중은 숫자 키패드
- **터치**: Chip ≥ 44px, Tab ≥ 44px
- **Navigation 계약**
  - Incoming: `location.state = { presetId: string } | null` (프리셋 재실행 시 구성 프리필)
  - Outgoing: 실행 → `navigate('/backtest/result', { state: { presetId: string; years: 1 | 3 | 5 | 10 } })`

### S6. 백테스트 리포트 — `/backtest/result`

- **TDS 컴포넌트**: `Top`(뒤로), `Card`(지표 4개 + 연도별), `Button`, `Chip`(기간 배지), `Toast`, `Spacing`, `Paragraph.Text`(고지 문구)
- **템플릿 컴포넌트**: `ScreenScaffold`, `SummaryHero`, `Sparkline`, `MiniBar`, `TossRewardAd`, `AdSlot`
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, `data-testid="summary-hero"` `SummaryHero`(최종 평가금액 CountUp t2 + 총 수익률 배지), `data-testid="equity-sparkline"` `Sparkline` 1개, `data-testid="metric-card"` `Card` 정확히 4개(CAGR/MDD/샤프/연변동성, 값 타이포 t2~t3), `data-testid="yearly-bar"` `MiniBar` 연도 수만큼
- **리워드 광고 게이트**: 상세 지표 4개 Card + 연도별 `MiniBar` 를 `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>` 로 감싼다. 무료 요약(Hero + Sparkline)은 게이트 밖.
- **상태**: Loading = 지표 자리 `Skeleton` 4개; Empty = `mta:lastBacktest` 없음 → `"먼저 백테스트를 실행해주세요"` + `"백테스트 하러 가기"` Button; Error = 광고 실패 시 Toast `"광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요"`
- **광고 배치**: `AdSlot` 은 지표 카드 섹션 **아래**, 고지 문구 **위** 1개
- **터치**: `"상세 리포트 보기"` Button ≥ 48px, `display="block"`
- **Navigation 계약**
  - Incoming: `location.state = { presetId: string; years: 1 | 3 | 5 | 10 } | null`
  - Outgoing: `"백테스트 하러 가기"` / `"다시 구성하기"` → `navigate('/backtest', { state: { presetId: string } })`
  - Outgoing: 뒤로 → `navigate('/backtest')`

### S7. 투자성향 퀴즈 — `/quiz`

- **TDS 컴포넌트**: `Top`(뒤로 = 이전 문항), `ListRow`(4지선다 보기), `Chip`, `Button`, `Spacing`, `Paragraph.Text`
- **템플릿 컴포넌트**: `ScreenScaffold`, `SubmitFooter`, `MiniBar`(진행률 1/8~8/8)
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, 상단 `data-testid="quiz-progress"` `MiniBar` 1개, 보기는 `ListRow` 4개, 1차 액션 `"다음"` / 마지막 문항 `"결과 보기"` 는 `SubmitFooter`
- **상태**: Loading = 없음(즉시 렌더); Empty = 해당 없음; Error = 미선택 시 `"답변을 선택해주세요"`
- **터치**: 보기 `ListRow` ≥ 56px
- **Navigation 계약**
  - Incoming: `location.state = null`
  - Outgoing: 마지막 응답 → `navigate('/quiz/result', { state: { score: number; type: RiskType } })`

### S8. 퀴즈 결과 — `/quiz/result`

- **TDS 컴포넌트**: `Top`, `Card`(성향 결과 + 추천 종목 3개), `Chip`, `Button`, `Spacing`, `Paragraph.Text`(고지 문구)
- **템플릿 컴포넌트**: `ScreenScaffold`, `SummaryHero`, `AdSlot`
- **Layout/Presentation 계약**: `data-testid="quiz-type-hero"` `SummaryHero`(성향명 t2 + 점수 배지), `data-testid="recommend-card"` `Card` 정확히 3개
- **상태**: Loading = 없음; Empty = `location.state` 없고 `mta:quiz` 도 없으면 `"진단을 먼저 진행해주세요"` + `"진단 시작"` Button; Error = 없음
- **광고 배치**: `AdSlot` 은 추천 카드 아래, 고지 문구 위
- **Navigation 계약**
  - Incoming: `location.state = { score: number; type: RiskType } | null` (null이면 `mta:quiz` fallback)
  - Outgoing: 추천 종목 카드 탭 → `navigate('/trade/:symbol', { state: { symbol: string; from: 'market' } })`
  - Outgoing: `"진단 시작"` → `navigate('/quiz')`

### S9. 랭킹 — `/leaderboard`

- **TDS 컴포넌트**: `Top`, `Tab`(전체/친구), `ListRow`(순위 행), `Chip`(연속 출석 배지), `Spacing`, `Paragraph.Text`
- **템플릿 컴포넌트**: `ScreenScaffold`, `SummaryHero`, `Asset.ContentIcon`, `AdSlot`, `FloatingTabBar`
- **Layout/Presentation 계약**: `ScreenScaffold` 필수, `data-testid="rank-hero"` `SummaryHero`(내 순위 CountUp t2 + 총 평가자산), `data-testid="leaderboard-me-row"` 는 화면 하단 고정 강조 행
- **상태**: Loading = `Skeleton` 10행; Empty = 친구 탭 `data-testid="leaderboard-friend-empty"`; Error = 로그인 미연동 시 닉네임 `"나"` 로 대체(에러 화면 없음)
- **스크롤**: 50행 → 네이티브 스크롤, 향후 50행 초과 시 가상 스크롤
- **터치**: `ListRow` ≥ 56px, Tab ≥ 44px
- **광고 배치**: `AdSlot` 은 순위 목록 아래, 내 순위 고정 행과 겹치지 않음
- **Navigation 계약**
  - Incoming: `location.state = null`
  - Outgoing: 없음(FloatingTabBar 이동만)

### 전역 라우팅

```ts
// src/App.tsx
<Routes>
  <Route path="/" element={<HomeScreen />} />
  <Route path="/market" element={<MarketScreen />} />
  <Route path="/trade/:symbol" element={<TradeScreen />} />
  <Route path="/portfolio" element={<PortfolioScreen />} />
  <Route path="/backtest" element={<BacktestSetupScreen />} />
  <Route path="/backtest/result" element={<BacktestResultScreen />} />
  <Route path="/quiz" element={<QuizScreen />} />
  <Route path="/quiz/result" element={<QuizResultScreen />} />
  <Route path="/leaderboard" element={<LeaderboardScreen />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

`FloatingTabBar` 노출 라우트: `/`, `/market`, `/portfolio`, `/leaderboard` (4탭). 나머지 라우트에서는 숨김.

---

## Data Storage

| 키 | 타입 | 초기값 | 상한 |
|---|---|---|---|
| `mta:meta` | `AppMeta` | `{ schemaVersion: 1, disclaimerSeen: false, onboardedAt: <ISO>, rewardUnlockedPresetIds: [] }` | `rewardUnlockedPresetIds` 최대 20개 |
| `mta:account` | `Account` | `{ cash: 1000000, lastGrantDate: <오늘>, totalGranted: 1000000, createdAt: <ISO> }` | — |
| `mta:positions` | `Record<string, Position>` | `{}` | 최대 20키 |
| `mta:trades` | `Trade[]` | `[]` | 최대 500건 (FIFO 삭제) |
| `mta:streak` | `StreakState` | `{ currentStreak: 1, longestStreak: 1, lastCheckInDate: <오늘>, totalBonus: 0 }` | — |
| `mta:presets` | `BacktestPreset[]` | `[]` | 최대 10개 |
| `mta:lastBacktest` | `BacktestResult \| null` | `null` | 1건 |
| `mta:quiz` | `QuizResult \| null` | `null` | 1건 |
| `mta:leaderboardSeed` | `LeaderboardEntry[]` | 봇 49명 결정적 생성 | 49건 |

**직렬화 규칙**: 모든 값은 `JSON.stringify` 로 저장. 읽기 시 `try/catch` 로 파싱 실패를 흡수하고 기본값으로 복구한다(F1 AC-4).
**총 추산 용량: 약 112KB (< 5MB)**

---

## API Contract

**외부 API 호출 없음.**

본 앱은 CP-2에 따라 백엔드 서버 및 외부 시세 API를 사용하지 않는다. 모든 데이터는 (a) 앱 번들에 포함된 정적 종목 마스터, (b) 결정적 가격 엔진의 계산 결과, (c) `localStorage` 로부터 온다. 따라서:

- REST 엔드포인트 정의 없음
- 통합 에러 응답 `{ error: string }` 사용처 없음
- CORS 설정 대상 없음 → F1 AC-7이 "외부 도메인 요청 0건"으로 이를 검증한다

**사용하는 SDK 표면 (외부 HTTP가 아닌 앱인토스 프레임워크 API)**

| 용도 | 호출 | 반환 |
|---|---|---|
| 로그인 연동 확인 | `getIsTossLoginIntegratedService()` | `Promise<boolean>` |
| 배너 광고 | `<AdSlot adGroupId={import.meta.env.VITE_TOSS_AD_GROUP_ID} />` | — |
| 리워드 광고 | `<TossRewardAd slotId={import.meta.env.VITE_TOSS_AD_SLOT_ID}>{children}</TossRewardAd>` | — |

**환경 변수**

| 변수 | 타입 | 출처 |
|---|---|---|
| `VITE_TOSS_AD_GROUP_ID` | `string` | 앱인토스 콘솔 (배너 광고 그룹) |
| `VITE_TOSS_AD_SLOT_ID` | `string` | 앱인토스 콘솔 (전면 리워드 슬롯) |

---

## Assumptions

1. **시세 데이터 출처**: PRD가 데이터 소스를 명시하지 않았고 서버 사용이 금지되므로, 실제 시장 데이터 대신 **번들 종목 마스터 + 결정적 GBM 가격 엔진**으로 시세와 과거 데이터를 생성한다. 종목명·코드는 실제 국내 대표종목/ETF를 사용하되, 가격은 시뮬레이션 값임을 CP-8 고지 문구로 명시한다.
2. **가격 기준일**: 모든 가격 시리즈는 `2016-01-01` 을 시작점으로 하며, 이는 최대 10년 백테스트를 커버한다.
3. **일일 가상자금**: PRD의 "매일 가상자금 100만원"을 **매일 100만원 추가 지급**(누적)으로 해석한다. 계좌 리셋 방식이 아니다.
4. **스트릭 보너스 금액**: PRD에 수치가 없어 `3일 10만 / 5일 30만 / 7일 이상 50만원` 으로 정의한다.
5. **백테스트 초기 투자금**: PRD에 수치가 없어 `1,000만원` 고정으로 정의한다.
6. **백테스트 방식**: 월말 리밸런싱 없는 매수 후 보유(buy & hold), 배당 미반영, 거래비용 미반영.
7. **샤프지수 무위험수익률**: `3.0%/년` 고정.
8. **친구 랭킹**: 토스 친구 목록 API를 사용하지 않으므로, 시드 봇 중 `isFriend: true` 로 표시된 항목을 "친구"로 간주한다(MVP 한정).
9. **생성형 AI 미사용**: 투자성향 진단과 백테스트 리포트는 전부 결정적 룰/수식 기반이므로 생성형 AI 고지 의무 대상이 아니다.
10. **IAP 미사용**: PRD Monetization이 ads 단독이므로 `TossPurchase` 는 이번 MVP에서 렌더하지 않는다.
11. **프로모션 리워드 미사용**: `grantPromotionReward` 는 MVP 범위 외. 추후 도입 시 `amount ≤ 5000` 검증 필수.

---

## Open Questions

1. **실제 시세 연동 여부** — 향후 실제 시세를 붙일 계획이라면 별도 Railway API 서버가 필요하다. MVP 이후 로드맵에 포함할 것인가?
2. **랭킹 서버화** — 실제 유저 간 랭킹 비교는 서버 없이는 불가능하다. 시드 봇 랭킹으로 MVP를 출시하고, 실 유저 랭킹은 외부 API 서버 도입 시점에 추가하는 안으로 확정해도 되는가?
3. **일일 지급 상한** — 무제한 누적 지급 시 장기 유저의 자산이 비현실적으로 커진다. 총 자산 상한(예: 1억원) 또는 주간 리셋을 도입할 것인가?
4. **종목 수** — 20개(주식 10 + ETF 10)로 충분한가, 아니면 50개로 확대가 필요한가?
5. **리워드 광고 해제 유효기간** — 프리셋별 영구 해제 vs 24시간 유효 중 어느 정책이 광고 전환 20% 가정에 부합하는가?
6. **투자성향 퀴즈 문항 원문** — 8문항 4지선다의 실제 문구를 기획에서 확정해 제공해야 한다(현재 SPEC은 채점 규칙만 정의).