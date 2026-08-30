/**
 * Packet 0019: 라우팅 배선 + 전역 Provider + 탭바 노출 제어
 * TDD Red Phase — Tests ONLY (src/App.tsx routing wiring not yet implemented)
 *
 * NOTE: this is a routing/integration packet — unlike page-unit tests, we do NOT
 * mock react-router-dom (no useNavigate/useLocation stub). We need the REAL router
 * to verify actual path matching, useParams, and wildcard redirect behavior. We
 * still mock TDS + the Toss SDK because those crash under jsdom (see CLAUDE.md).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

function renderAppAt(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );
}

// 메인탭(탭바 노출) 경로 vs 비메인탭(탭바 숨김) 경로 — spec.md S1~S9 요약 참조
const MAIN_TAB_ROUTES = ["/", "/market", "/portfolio", "/leaderboard"];
const NON_TAB_ROUTES = [
  "/trade/005930",
  "/backtest",
  "/backtest/result",
  "/quiz",
  "/quiz/result",
];
const ALL_DEFINED_ROUTES = [...MAIN_TAB_ROUTES, ...NON_TAB_ROUTES];

describe("Packet 0019: 라우팅 배선 + 전역 Provider + 탭바 노출 제어", () => {
  // ── AC-1[P0]: 9개 라우트 모두 렌더 + 직접 URL 진입 시 크래시 없음 ──
  describe("AC-1[P0]: 9개 라우트가 모두 렌더되고 직접 URL 진입 시에도 크래시하지 않는다", () => {
    it.each(ALL_DEFINED_ROUTES)("renders %s without throwing", (path) => {
      expect(() => renderAppAt(path)).not.toThrow();
      // root가 실제로 마운트됐는지(흰 화면 아님) — DOM에 콘텐츠가 있어야 한다
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
    });

    it("renders /trade/:symbol with the symbol route param reachable (no crash on dynamic segment)", () => {
      expect(() => renderAppAt("/trade/005930")).not.toThrow();
      expect(document.body.innerHTML.length).toBeGreaterThan(0);
    });
  });

  // ── AC-2[P0]: AppStateProvider로 전체 라우트가 감싸져 어느 경로에서도 정상 동작 ──
  describe("AC-2[P0]: 전체 라우트가 AppStateProvider로 감싸져 새로고침해도 정상 동작한다", () => {
    it.each(ALL_DEFINED_ROUTES)(
      "mounts cleanly at %s as if freshly loaded (simulated refresh — single entry, no history)",
      (path) => {
        // initialEntries에 단일 엔트리만 둬서 '새로고침(직접 진입)' 상황을 재현한다.
        const { unmount } = renderAppAt(path);
        expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
        unmount();
      },
    );

    it("does not throw when the same route tree remounts twice in sequence (no provider singleton crash)", () => {
      const first = renderAppAt("/portfolio");
      first.unmount();
      expect(() => renderAppAt("/portfolio")).not.toThrow();
    });
  });

  // ── AC-3[P0]: FloatingTabBar는 메인 탭 경로에서만 노출 ──
  describe("AC-3[P0]: FloatingTabBar가 홈/마켓/포트폴리오/랭킹에서만 보인다", () => {
    it.each(MAIN_TAB_ROUTES)("shows the tab bar (role=tablist) at %s", (path) => {
      renderAppAt(path);
      const tablist = screen.queryByRole("tablist", { name: /메인 네비게이션/ });
      expect(tablist).not.toBeNull();
      expect(tablist?.getAttribute("role")).toBe("tablist");
    });

    it.each(NON_TAB_ROUTES)("hides the tab bar (role=tablist) at %s", (path) => {
      renderAppAt(path);
      const tablist = screen.queryByRole("tablist", { name: /메인 네비게이션/ });
      expect(tablist).toBeNull();
    });
  });

  // ── AC-4[P0]: 정의되지 않은 경로는 홈으로 리다이렉트 ──
  describe("AC-4[P0]: 존재하지 않는 경로(/foo) 진입 시 홈으로 리다이렉트된다", () => {
    it("redirects /foo to the home tab bar view (tablist visible, same as '/')", () => {
      renderAppAt("/foo");
      // 리다이렉트되면 홈은 메인탭 경로이므로 탭바가 보여야 한다.
      const tablist = screen.queryByRole("tablist", { name: /메인 네비게이션/ });
      expect(tablist).not.toBeNull();
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
    });

    it("redirects another undefined path (/does-not-exist) without crashing", () => {
      expect(() => renderAppAt("/does-not-exist")).not.toThrow();
      const tablist = screen.queryByRole("tablist", { name: /메인 네비게이션/ });
      expect(tablist).not.toBeNull();
    });
  });

  // ── AC-5[P1]: main.tsx 미수정 (git diff 0줄) ──
  describe("AC-5[P1]: src/main.tsx는 이 패킷에서 수정되지 않는다 (@AI:ANCHOR)", () => {
    it("main.tsx still contains the @AI:ANCHOR guard comment (untouched anchor marker)", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const mainTsxPath = path.resolve(process.cwd(), "src/main.tsx");
      const content = fs.readFileSync(mainTsxPath, "utf-8");
      expect(content).toContain("@AI:ANCHOR");
      expect(content).toContain("TDSMobileAITProvider");
    });
  });
});
