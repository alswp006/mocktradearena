// 전역 네비게이션 상수 — 라우팅 배선(App.tsx)과 각 화면의 FloatingTabBar가 공유한다.
//
// @AI:NOTE 하단 탭은 App.tsx가 아니라 각 메인 탭 화면이 직접 렌더한다(중복 렌더 방지).
// 새 화면을 만들 때 그 경로가 MAIN_TAB_PATHS에 있으면 화면 하단에
// <FloatingTabBar items={MAIN_TAB_ITEMS} />를 넣고, 없으면 넣지 마라.
// (탭바가 보이면 안 되는 화면: /trade/:symbol, /backtest, /backtest/result, /quiz, /quiz/result)

import type { TabItem } from "@/components/FloatingTabBar";

/** FloatingTabBar를 노출하는 메인 탭 경로 4개 (spec "전역 라우팅"). */
export const MAIN_TAB_PATHS = ["/", "/market", "/portfolio", "/leaderboard"] as const;

export type MainTabPath = (typeof MAIN_TAB_PATHS)[number];

/** 하단 탭 구성 — 순서가 곧 탭 순서다. */
export const MAIN_TAB_ITEMS: TabItem[] = [
  { label: "홈", path: "/" },
  { label: "마켓", path: "/market" },
  { label: "포트폴리오", path: "/portfolio" },
  { label: "랭킹", path: "/leaderboard" },
];

/** 주어진 경로에서 하단 탭을 보여야 하는지 판정한다. */
export function isMainTabPath(pathname: string): boolean {
  return (MAIN_TAB_PATHS as readonly string[]).includes(pathname);
}
