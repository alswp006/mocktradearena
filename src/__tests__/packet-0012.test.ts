// TDD red phase — 포트폴리오 (S4) 보유종목 탭, packet 0012.
//
// src/pages/Portfolio.tsx already exists as a routing-scaffold placeholder from packet 0019
// (라우팅 배선), but it was never driven by this packet's ACs — e.g. it never sums/shows
// 총 평가손익, its empty-state and per-row markup don't expose testable per-field text the
// way this contract requires, and it has no handling of location.state.justTradedSymbol at
// all (no Chip '방금 거래'). These tests describe the packet-0012 contract per
// .ai-factory/spec.md §S4 and WILL fail until the Coder rewrites Portfolio.tsx.
//
// Strategy: use the REAL AppStateProvider (src/store/AppStateContext) — totalAsset math
// (packet 0005/0019) is already implemented there — and seed localStorage via
// src/lib/storage.ts for precise control over cash/positions per AC. Prices come from the
// REAL deterministic price engine (getClose), so expected numbers are computed the same way
// the page must compute them (no random/mock prices).

import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter, mockNavigate } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

import { AppStateProvider } from "@/store/AppStateContext";
import Portfolio from "@/pages/Portfolio";
import { saveAccount, savePositions } from "@/lib/storage";
import { todayKst, parseKSTDate } from "@/lib/date";
import { getClose } from "@/lib/priceEngine";
import { getInstrument } from "@/data/instruments";
import { formatNumber } from "@/lib/utils";
import type { Account, PositionMap } from "@/lib/types";

const SYMBOL_A = "005930"; // 삼성전자
const SYMBOL_B = "069500"; // KODEX 200

function seedAccount(overrides: Partial<Account> = {}) {
  saveAccount({
    cash: 3_000_000,
    lastGrantDate: parseKSTDate(todayKst()),
    totalGranted: 1_000_000,
    createdAt: parseKSTDate(todayKst()),
    ...overrides,
  });
}

function seedPositions(positions: PositionMap = {}) {
  savePositions(positions);
}

function renderPortfolio(initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/portfolio"]) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries },
      React.createElement(
        AppStateProvider,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/portfolio", element: React.createElement(Portfolio) }),
        ),
      ),
    ),
  );
}

describe("포트폴리오 (S4) — 보유종목 탭", () => {
  // ── AC-1: 총 평가자산·총 평가손익 계산 및 콤마 표기 ──
  it("AC-1: 총 평가자산 = 현금 + Σ(qty×종가), 총 평가손익 = Σ((현재가-평균단가)×qty)로 콤마 표기 표시된다", () => {
    const cash = 3_000_000;
    seedAccount({ cash });
    const positions: PositionMap = {
      [SYMBOL_A]: { symbol: SYMBOL_A, qty: 5, avgPrice: 65_000 },
      [SYMBOL_B]: { symbol: SYMBOL_B, qty: 3, avgPrice: 30_000 },
    };
    seedPositions(positions);

    const today = todayKst();
    const priceA = getClose(SYMBOL_A, today);
    const priceB = getClose(SYMBOL_B, today);
    const holdingsValue = 5 * priceA + 3 * priceB;
    const totalAsset = cash + holdingsValue;
    const totalPnl = (priceA - 65_000) * 5 + (priceB - 30_000) * 3;

    renderPortfolio();

    const hero = screen.getByTestId("portfolio-hero");
    expect(hero.textContent).toContain(formatNumber(totalAsset));
    expect(hero.textContent).toContain(formatNumber(Math.abs(totalPnl)));
  });

  // ── AC-2: 빈 상태 ──
  it("AC-2: 보유종목이 0개면 EmptyState('아직 보유 종목이 없어요')와 '마켓 둘러보기' 버튼이 보이고 탭 시 /market으로 이동한다", () => {
    seedAccount();
    seedPositions({});

    renderPortfolio();

    expect(screen.getByTestId("portfolio-empty")).toBeTruthy();
    expect(screen.getByText("아직 보유 종목이 없어요")).toBeTruthy();

    const goToMarket = screen.getByRole("button", { name: "마켓 둘러보기" });
    fireEvent.click(goToMarket);
    expect(mockNavigate).toHaveBeenCalledWith("/market", { state: { from: "portfolio" } });
  });

  // ── AC-3: 보유종목 행 필드 표시 + 탭 시 이동 ──
  it("AC-3: 각 행에 종목명·보유수량·평균단가·평가금액·수익률(소수 2자리)이 표시되고 탭 시 /trade/:symbol로 이동한다", () => {
    seedAccount();
    const positions: PositionMap = {
      [SYMBOL_A]: { symbol: SYMBOL_A, qty: 5, avgPrice: 65_000 },
    };
    seedPositions(positions);

    const today = todayKst();
    const price = getClose(SYMBOL_A, today);
    const evalAmount = 5 * price;
    const returnPct = ((price - 65_000) / 65_000) * 100;
    const instrument = getInstrument(SYMBOL_A);

    renderPortfolio();

    const card = screen.getByTestId("portfolio-position-card");
    expect(card.textContent).toContain(instrument?.name);
    expect(card.textContent).toContain("5주");
    expect(card.textContent).toContain(formatNumber(65_000));
    expect(card.textContent).toContain(formatNumber(evalAmount));
    expect(card.textContent).toContain(returnPct.toFixed(2));

    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith(`/trade/${SYMBOL_A}`, {
      state: { symbol: SYMBOL_A, from: "portfolio" },
    });
  });

  // ── AC-4: 방금 거래한 종목 하이라이트 ──
  it("AC-4: location.state.justTradedSymbol이 있으면 해당 행에 Chip '방금 거래'가 표시된다", () => {
    seedAccount();
    const positions: PositionMap = {
      [SYMBOL_A]: { symbol: SYMBOL_A, qty: 5, avgPrice: 65_000 },
      [SYMBOL_B]: { symbol: SYMBOL_B, qty: 3, avgPrice: 30_000 },
    };
    seedPositions(positions);

    renderPortfolio([{ pathname: "/portfolio", state: { justTradedSymbol: SYMBOL_A } }]);

    const cards = screen.getAllByTestId("portfolio-position-card");
    expect(cards).toHaveLength(2);

    const highlightedCard = cards.find((c) => c.textContent?.includes("방금 거래"));
    expect(highlightedCard).toBeTruthy();
    expect(highlightedCard?.textContent).toContain(getInstrument(SYMBOL_A)?.name);

    const otherCard = cards.find((c) => c !== highlightedCard);
    expect(otherCard?.textContent).not.toContain("방금 거래");
  });

  // ── AC-5: Tab 골격 + 모의투자 고지 ──
  it("AC-5: 보유종목/거래내역 Tab이 렌더되어 전환이 동작하고 하단에 모의투자 고지 문구가 노출된다", () => {
    seedAccount();
    seedPositions({
      [SYMBOL_A]: { symbol: SYMBOL_A, qty: 5, avgPrice: 65_000 },
    });

    renderPortfolio();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain("보유종목");
    expect(tabs[1].textContent).toContain("거래내역");

    // 초기엔 보유종목 탭이 선택되어 있고 포지션 카드가 보인다
    expect(screen.getByTestId("portfolio-position-card")).toBeTruthy();

    // 거래내역 탭으로 전환하면 보유종목 카드는 더 이상 보이지 않는다
    fireEvent.click(tabs[1]);
    expect(screen.queryByTestId("portfolio-position-card")).toBeNull();

    expect(
      screen.getByText("본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.")
    ).toBeTruthy();
  });

  // ── 부가: 마스터에 없는 심볼은 무음 필터링(에러 없이 렌더) ──
  it("AC-1 edge: 마스터에 없는 심볼 포지션은 크래시 없이 무음 필터링된다", () => {
    seedAccount({ cash: 1_000_000 });
    seedPositions({
      "999999": { symbol: "999999", qty: 10, avgPrice: 1_000 },
      [SYMBOL_A]: { symbol: SYMBOL_A, qty: 1, avgPrice: 65_000 },
    });

    renderPortfolio();

    const cards = screen.getAllByTestId("portfolio-position-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain(getInstrument(SYMBOL_A)?.name);
  });
});
