// TDD red phase — 홈 화면 (S1), packet 0009.
// src/pages/Home.tsx is NOT yet fully implemented per this packet's ACs — tests WILL fail.
//
// Strategy: use the REAL AppStateProvider (src/store/AppStateContext) instead of mocking
// useAppState — the daily-grant/streak/disclaimer logic already lives there (packet 0006),
// so seeding localStorage via src/lib/storage.ts gives us precise, deterministic control
// over every AC without re-implementing that logic in a mock.

import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

import { AppStateProvider } from "@/store/AppStateContext";
import Home from "@/pages/Home";
import { saveAccount, savePositions, saveStreak, saveMeta, STORAGE_KEYS } from "@/lib/storage";
import { todayKst, addDaysKST, parseKSTDate } from "@/lib/date";
import { getClose } from "@/lib/priceEngine";
import { formatNumber } from "@/lib/utils";
import type { Account, PositionMap, StreakState, AppMeta } from "@/lib/types";

function seedAccount(overrides: Partial<Account> = {}) {
  saveAccount({
    cash: 200_000,
    lastGrantDate: parseKSTDate(todayKst()),
    totalGranted: 1_000_000,
    createdAt: parseKSTDate(todayKst()),
    ...overrides,
  });
}

function seedPositions(positions: PositionMap = {}) {
  savePositions(positions);
}

function seedStreak(overrides: Partial<StreakState> = {}) {
  saveStreak({
    currentStreak: 1,
    longestStreak: 1,
    lastCheckInDate: todayKst(),
    totalBonus: 0,
    ...overrides,
  });
}

function seedMeta(overrides: Partial<AppMeta & { disclaimerSeen: boolean }> = {}) {
  saveMeta({
    version: "1",
    lastUpdated: new Date(),
    dataVersion: "1",
    // @ts-expect-error storage.ts widens AppMeta at runtime with these extra fields
    schemaVersion: 1,
    disclaimerSeen: true,
    onboardedAt: new Date().toISOString(),
    rewardUnlockedPresetIds: [],
    ...overrides,
  });
}

function renderHome() {
  return render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(AppStateProvider, null, React.createElement(Home)),
    ),
  );
}

describe("홈 화면 (S1) — 히어로·스트릭·메뉴 카드·고지", () => {
  beforeEach(() => {
    // 기본값: 오늘 이미 지급됨(Toast 없음) + 고지 이미 확인됨(다이얼로그 없음) + 보유종목 없음.
    // 각 AC 테스트가 필요에 따라 오버라이드한다.
    seedAccount();
    seedPositions({});
    seedStreak();
    seedMeta();
  });

  // ── AC-1[P0]: 총 평가자산 = 현금 + Σ(보유수량 × 오늘 종가) ──
  describe("AC-1[P0]: 총 평가자산 계산 및 콤마 표시", () => {
    it("displays cash + Σ(qty × todayClose) formatted with thousands commas", () => {
      const today = todayKst();
      const close = getClose("005930", today);
      seedAccount({ cash: 300_000, lastGrantDate: parseKSTDate(today) });
      seedPositions({ "005930": { symbol: "005930", qty: 2, avgPrice: 70_000 } });

      renderHome();

      const expectedTotal = 300_000 + 2 * close;
      const hero = screen.getByTestId("home-asset-hero");
      expect(hero.textContent).toContain(formatNumber(expectedTotal));
      expect(hero.textContent).toContain("원");
    });

    it("falls back to cash only when there are no holdings", () => {
      seedAccount({ cash: 750_000, lastGrantDate: parseKSTDate(todayKst()) });
      seedPositions({});

      renderHome();

      const hero = screen.getByTestId("home-asset-hero");
      expect(hero.textContent).toContain(formatNumber(750_000));
    });
  });

  // ── AC-2[P1]: 보유 종목 0개 → EmptyState + '/market' 이동 ──
  describe("AC-2[P1]: 보유 종목 0개면 EmptyState가 보이고 CTA 탭 시 /market으로 이동한다", () => {
    it("renders EmptyState with data-testid='home-holdings-empty' when positions is empty", () => {
      seedPositions({});

      renderHome();

      const empty = screen.getByTestId("home-holdings-empty");
      expect(empty.getAttribute("data-testid")).toBe("home-holdings-empty");
      expect(screen.queryByTestId("home-holdings-empty")).not.toBeNull();
    });

    it("navigates to /market when '모의매매 시작하기' is tapped inside the empty state", () => {
      seedPositions({});

      renderHome();

      const emptyState = screen.getByTestId("home-holdings-empty");
      const cta = within(emptyState).getByText(/모의매매 시작하기/);
      cta.click();

      expect(mockNavigate).toHaveBeenCalledWith("/market");
    });
  });

  // ── AC-3[P0]: 일일 지급 Toast — 발생 시에만, 같은 날 재진입 시 미노출 ──
  describe("AC-3[P0]: 일일 지급 발생 시에만 Toast가 뜨고 같은 날 재진입 시 뜨지 않는다", () => {
    it("shows the grant Toast when the daily grant just happened (lastGrantDate = yesterday)", async () => {
      seedAccount({ cash: 200_000, lastGrantDate: parseKSTDate(addDaysKST(todayKst(), -1)) });
      seedStreak({ currentStreak: 0, longestStreak: 0, lastCheckInDate: "", totalBonus: 0 });

      renderHome();

      await waitFor(() => {
        const toast = screen.getByText("오늘의 가상자금 1,000,000원이 지급됐어요");
        expect(toast.textContent).toBe("오늘의 가상자금 1,000,000원이 지급됐어요");
      });
      expect(screen.queryAllByText("오늘의 가상자금 1,000,000원이 지급됐어요")).toHaveLength(1);
    });

    it("does not show the grant Toast on same-day re-entry (lastGrantDate = today)", async () => {
      seedAccount({ cash: 200_000, lastGrantDate: parseKSTDate(todayKst()) });

      renderHome();

      expect(screen.queryByText("오늘의 가상자금 1,000,000원이 지급됐어요")).toBeNull();
      expect(screen.queryAllByText("오늘의 가상자금 1,000,000원이 지급됐어요")).toHaveLength(0);
    });
  });

  // ── AC-4[P0]: 모의투자 고지 — 최초 1회, 확인 시 저장되어 재노출 안 됨 ──
  describe("AC-4[P0]: mta:meta.disclaimerSeen=false면 고지 다이얼로그가 뜨고 확인 시 저장된다", () => {
    it("shows the AlertDialog when disclaimerSeen is false, and confirming persists disclaimerSeen=true", async () => {
      seedMeta({ disclaimerSeen: false });

      renderHome();

      const dialog = screen.getByRole("alertdialog");
      expect(dialog.getAttribute("role")).toBe("alertdialog");

      const confirmBtn = within(dialog).getByText("확인");
      confirmBtn.click();

      await waitFor(() => {
        const raw = localStorage.getItem(STORAGE_KEYS.meta);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string).disclaimerSeen).toBe(true);
      });
      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).toBeNull();
      });
    });

    it("does not show the AlertDialog when disclaimerSeen is already true", () => {
      seedMeta({ disclaimerSeen: true });

      renderHome();

      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.queryAllByRole("alertdialog")).toHaveLength(0);
    });
  });

  // ── AC-5[P1]: 모의투자 고지 문구가 하단에 항상 노출 ──
  describe("AC-5[P1]: 모의투자 안내 문구가 항상 하단에 노출된다", () => {
    it("always renders the fixed disclaimer copy at the bottom of the screen", () => {
      renderHome();

      const disclaimer = screen.getByText(
        "본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.",
      );
      expect(disclaimer.textContent).toBe(
        "본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.",
      );
    });
  });
});
