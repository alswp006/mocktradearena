// TDD red phase — 포트폴리오 거래내역 탭 + 대량 리스트 처리, packet 0013.
//
// src/components/TradeHistoryTab.tsx does not exist yet. Portfolio.tsx currently renders a
// bare `data-testid="portfolio-history-slot"` placeholder for the 거래내역 탭 (see packet
// 0012). This packet replaces that placeholder with a real component: sorted history rows,
// BUY/SELL Chip, 50+ item windowed rendering with a "더 보기" load-more affordance, and an
// empty state. These tests WILL fail until the Coder implements both files.
//
// Strategy: unit-test TradeHistoryTab directly with concrete Trade[] fixtures (fast, no
// timezone coupling — date format is asserted via regex, not an exact string, since the
// formatter's timezone choice is an implementation detail). Then a thin integration test
// drives Portfolio itself (real AppStateProvider + storage seeding, per packet-0012's
// pattern) to confirm the placeholder was actually wired in and the 보유종목 tab/summary
// math were left untouched.

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd, mockRouter } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();
mockRouter();

import { TradeHistoryTab } from "@/components/TradeHistoryTab";
import { AppStateProvider } from "@/store/AppStateContext";
import Portfolio from "@/pages/Portfolio";
import { saveAccount, savePositions, saveTrades } from "@/lib/storage";
import { todayKst, parseKSTDate } from "@/lib/date";
import { formatNumber } from "@/lib/utils";
import type { Account, Trade } from "@/lib/types";

const SYMBOL_A = "005930"; // 삼성전자
const SYMBOL_B = "069500"; // KODEX 200

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: `trade-${Math.random().toString(36).slice(2)}`,
    symbol: SYMBOL_A,
    name: "삼성전자",
    side: "BUY",
    qty: 10,
    price: 70_000,
    fee: 105,
    amount: 700_000,
    tradedAt: new Date("2026-08-01T09:00:00+09:00"),
    ...overrides,
  };
}

function renderTab(trades: Trade[], onGoMarket = vi.fn()) {
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(TradeHistoryTab, { trades, onGoMarket }),
    ),
  );
  return { onGoMarket };
}

describe("포트폴리오 거래내역 탭 + 대량 리스트 처리", () => {
  // ── AC-1: 정렬 + 행 필드 표시 ──
  it("AC-1[P0]: tradedAt 내림차순 정렬되고 각 행에 매수/매도, 종목명, 수량·체결가, 수수료, 일시가 표시된다", () => {
    const oldest = makeTrade({
      id: "t1",
      symbol: SYMBOL_A,
      name: "삼성전자",
      side: "BUY",
      qty: 10,
      price: 70_000,
      fee: 105,
      tradedAt: new Date("2026-08-01T09:00:00+09:00"),
    });
    const newest = makeTrade({
      id: "t2",
      symbol: SYMBOL_B,
      name: "KODEX 200",
      side: "SELL",
      qty: 3,
      price: 30_000,
      fee: 162,
      tradedAt: new Date("2026-08-15T14:23:00+09:00"),
    });

    renderTab([oldest, newest]);

    const rows = screen.getAllByTestId("trade-history-row");
    expect(rows).toHaveLength(2);

    // 최신순 — newest(t2)가 첫 행
    expect(rows[0].textContent).toContain("KODEX 200");
    expect(rows[1].textContent).toContain("삼성전자");

    // 첫 행(SELL) 필드 검증
    expect(rows[0].textContent).toContain("매도");
    expect(rows[0].textContent).toContain("3주");
    expect(rows[0].textContent).toContain(formatNumber(30_000));
    expect(rows[0].textContent).toContain(formatNumber(162));
    expect(rows[0].textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);

    // 둘째 행(BUY) 필드 검증
    expect(rows[1].textContent).toContain("매수");
    expect(rows[1].textContent).toContain("10주");
    expect(rows[1].textContent).toContain(formatNumber(70_000));
    expect(rows[1].textContent).toContain(formatNumber(105));
  });

  // ── AC-2: 빈 상태 ──
  it("AC-2[P1]: 거래내역이 0건이면 EmptyState('아직 거래 내역이 없어요')와 '마켓 보러가기' 버튼이 표시된다", () => {
    const { onGoMarket } = renderTab([]);

    expect(screen.getByText("아직 거래 내역이 없어요")).toBeTruthy();
    expect(screen.queryByTestId("trade-history-row")).toBeNull();

    const cta = screen.getByRole("button", { name: "마켓 보러가기" });
    fireEvent.click(cta);
    expect(onGoMarket).toHaveBeenCalledTimes(1);
  });

  // ── AC-3: 500건 부분 렌더 + 더 보기 ──
  it("AC-3[P0]: 거래 500건 중 초기 렌더는 30건만 DOM에 생성하고 '더 보기' 클릭 시 30건씩 추가된다", () => {
    const trades: Trade[] = Array.from({ length: 500 }, (_, i) =>
      makeTrade({
        id: `t${i}`,
        tradedAt: new Date(Date.parse("2026-01-01T00:00:00+09:00") + i * 60_000),
      }),
    );

    renderTab(trades);

    expect(screen.getAllByTestId("trade-history-row")).toHaveLength(30);

    const loadMore = screen.getByRole("button", { name: "더 보기" });
    fireEvent.click(loadMore);
    expect(screen.getAllByTestId("trade-history-row")).toHaveLength(60);

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(screen.getAllByTestId("trade-history-row")).toHaveLength(90);
  });

  // ── AC-4: 매수/매도 Chip 구분 ──
  it("AC-4[P1]: 매수/매도가 Chip label '매수'/'매도'로 구분되어 렌더된다", () => {
    const buy = makeTrade({ id: "b1", side: "BUY", tradedAt: new Date("2026-08-10T10:00:00+09:00") });
    const sell = makeTrade({ id: "s1", side: "SELL", tradedAt: new Date("2026-08-11T10:00:00+09:00") });

    renderTab([buy, sell]);

    const rows = screen.getAllByTestId("trade-history-row");
    const sellRow = within(rows[0]);
    const buyRow = within(rows[1]);

    expect(sellRow.getByText("매도")).toBeTruthy();
    expect(buyRow.getByText("매수")).toBeTruthy();
  });

  // ── AC-5: Portfolio 통합 — placeholder 교체 + 보유종목 로직 불변 ──
  it("AC-5[P0]: Portfolio의 거래내역 탭이 TradeHistoryTab으로 교체되고 보유종목 탭·요약 계산은 그대로다", () => {
    const cash = 3_000_000;
    saveAccount({
      cash,
      lastGrantDate: parseKSTDate(todayKst()),
      totalGranted: 1_000_000,
      createdAt: parseKSTDate(todayKst()),
    } as Account);
    savePositions({ [SYMBOL_A]: { symbol: SYMBOL_A, qty: 5, avgPrice: 65_000 } });
    saveTrades([
      makeTrade({ id: "pt1", symbol: SYMBOL_A, name: "삼성전자", tradedAt: new Date("2026-08-20T11:00:00+09:00") }),
    ]);

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/portfolio"] },
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

    // 보유종목 탭은 그대로 카드 1개 (packet 0012 로직 불변)
    expect(screen.getByTestId("portfolio-position-card")).toBeTruthy();
    expect(screen.getByTestId("portfolio-hero")).toBeTruthy();

    // 거래내역 탭으로 전환 — placeholder(portfolio-history-slot)가 아니라 실제 내역 행이 보인다
    const tabs = screen.getAllByRole("tab");
    fireEvent.click(tabs[1]);

    expect(screen.queryByTestId("portfolio-history-slot")).toBeNull();
    expect(screen.getAllByTestId("trade-history-row")).toHaveLength(1);
    expect(screen.getByTestId("trade-history-row").textContent).toContain("삼성전자");

    // 보유종목 탭으로 되돌아가도 요약/카드 로직은 영향받지 않는다
    fireEvent.click(tabs[0]);
    expect(screen.getByTestId("portfolio-position-card")).toBeTruthy();
  });
});
