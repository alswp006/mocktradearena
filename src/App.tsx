import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppStateProvider } from '@/store/AppStateContext';
import type { RouteState } from '@/lib/contract';
import Home from './pages/Home';
import Market from './pages/Market';
import Trade from './pages/Trade';
import Portfolio from './pages/Portfolio';
import Backtest from './pages/Backtest';
import BacktestResult from './pages/BacktestResult';
import Quiz from './pages/Quiz';
import QuizResult from './pages/QuizResult';
import Leaderboard from './pages/Leaderboard';

// 하단 탭 노출 경로는 src/lib/navigation.ts가 단일 출처다.
// 각 메인 탭 화면이 <FloatingTabBar items={MAIN_TAB_ITEMS} />를 직접 렌더하고,
// App은 중복 렌더하지 않는다(탭바가 두 개 그려지는 것을 막기 위함).
export { MAIN_TAB_PATHS, MAIN_TAB_ITEMS, isMainTabPath } from '@/lib/navigation';

// Dev-only TDS Gallery route — `import.meta.env.DEV` is statically replaced
// (true in dev, false in prod) so the entire import + Route is tree-shaken
// from production builds. Verify with: `grep -r "TdsGallery" dist/` → empty.
const DevTdsGallery = import.meta.env.DEV
  ? lazy(() => import('./pages/__TdsGallery'))
  : null;

/** 화면 이름 → 실제 경로. trade는 진입 시 instrumentId를 뒤에 붙인다. */
const SCREEN_PATHS: Record<RouteState['currentScreen'], string> = {
  home: '/',
  market: '/market',
  trade: '/trade',
  portfolio: '/portfolio',
  backtest: '/backtest',
  quiz: '/quiz',
  quizResult: '/quiz/result',
  leaderboard: '/leaderboard',
};

function pathnameToScreen(pathname: string): RouteState['currentScreen'] {
  if (pathname.startsWith('/trade')) return 'trade';
  if (pathname.startsWith('/backtest')) return 'backtest';
  if (pathname === '/quiz/result') return 'quizResult';
  if (pathname.startsWith('/quiz')) return 'quiz';
  if (pathname === '/market') return 'market';
  if (pathname === '/portfolio') return 'portfolio';
  if (pathname === '/leaderboard') return 'leaderboard';
  return 'home';
}

/**
 * 라우팅 상태 훅 (contract: useRouteFn) — react-router 위에 얇게 얹어
 * 현재 화면 이름과 tradePreview를 읽고, 화면 이름 기반 네비게이션을 제공한다.
 */
export function useRoute(): { current: RouteState; navigate: (screen: string, preview?: any) => void } {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const params = useParams<{ symbol?: string }>();

  const currentScreen = pathnameToScreen(location.pathname);
  const incomingState = (location.state ?? null) as { tradePreview?: RouteState['tradePreview'] } | null;
  const tradePreview =
    incomingState?.tradePreview ??
    (currentScreen === 'trade' && params.symbol
      ? { instrumentId: params.symbol, quantity: 0, type: 'buy' as const }
      : undefined);

  const navigate = (screen: string, preview?: any) => {
    const basePath = SCREEN_PATHS[screen as RouteState['currentScreen']] ?? '/';
    const path = screen === 'trade' && preview?.instrumentId ? `${basePath}/${preview.instrumentId}` : basePath;
    routerNavigate(path, preview ? { state: { tradePreview: preview } } : undefined);
  };

  return { current: { currentScreen, tradePreview }, navigate };
}

export default function App() {
  return (
    // BrowserRouter는 main.tsx(@AI:ANCHOR)가 이미 감싸고 있다 — 여기서 또 감싸면
    // 라우터가 중첩돼 경로 매칭이 깨진다. App은 Provider + Routes만 담당한다.
    <AppStateProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/market" element={<Market />} />
        <Route path="/trade/:symbol" element={<Trade />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/backtest/result" element={<BacktestResult />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/quiz/result" element={<QuizResult />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        {DevTdsGallery && (
          <Route
            path="/__tds-gallery"
            element={
              <Suspense fallback={null}>
                <DevTdsGallery />
              </Suspense>
            }
          />
        )}
        {/* 정의되지 않은 경로는 막다른 길이 되지 않도록 홈으로 되돌린다. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppStateProvider>
  );
}
