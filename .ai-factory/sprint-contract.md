# Sprint Contract: App.tsx 라우팅 배선 + 전역 Provider + 탭바 제어

## 목표
App.tsx에서 react-router-dom 라우트 9개 연결, AppStateProvider 감싸기, FloatingTabBar 메인 탭 경로만 노출, 정의되지 않은 경로는 홈 리다이렉트.

## 파일 생성/수정

| 파일 | 작업 | 상세 |
|------|------|------|
| `src/App.tsx` | 수정 | Routes 9개 추가 (market, trade/:symbol, portfolio, backtest, backtest/result, quiz, quiz/result, leaderboard), AppStateProvider 감싸기, <Navigate> 와일드카드 리다이렉트, 메인탭 경로만 FloatingTabBar 노출 |
| `src/pages/Market.tsx` | 생성 | 기본 골격 (ScreenScaffold, 빈 상태) |
| `src/pages/Trade.tsx` | 생성 | 상품 상세 (useParams로 symbol 가져옴, 빈 상태) |
| `src/pages/Portfolio.tsx` | 생성 | 포트폴리오 (메인탭, ScreenScaffold) |
| `src/pages/Backtest.tsx` | 생성 | 백테스트 입력 (ScreenScaffold) |
| `src/pages/BacktestResult.tsx` | 생성 | 백테스트 결과 (useLocation.state 처리) |
| `src/pages/Quiz.tsx` | 생성 | 퀴즈 (ScreenScaffold) |
| `src/pages/QuizResult.tsx` | 생성 | 퀴즈 결과 (useLocation.state 처리) |
| `src/pages/Leaderboard.tsx` | 생성 | 랭킹 (메인탭, ScreenScaffold) |

## 사용할 타입 (src/lib/types.ts)
- `RouteState` — 라우트 state 계약 (9경로 정의 완료)
- `Instrument`, `Account`, `Position`, `Trade` — 기본 도메인 타입 (필요시 import)

## 검증
1. `npx tsc --noEmit` — RouteState 맞춤 확인
2. `npm run test:visual` — 메인탭 4경로(홈/마켓/포트폴리오/랭킹)만 FloatingTabBar 노출, 나머지는 미노출
3. 정의되지 않은 경로(`/invalid`) → 홈 리다이렉트 확인

## 금지 사항
- main.tsx 수정 금지 (@AI:ANCHOR)
- AppStateProvider 전역 상태 저장소는 다음 패킷 (현재는 Context/Store 구조만 선언)
- 페이지 내용(비즈니스 로직) 구현 금지 — 골격만
