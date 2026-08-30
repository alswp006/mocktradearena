// TDD red phase — 마켓 화면 (S2), packet 0010.
// src/pages/Market.tsx exists but only implements search (no 등락률 표시, no tab filter,
// wrong empty-state copy) — these tests describe the full AC set and WILL fail until the
// Coder adds: 등락률 필드(testid market-change-{symbol}), 전체/주식/ETF 탭, 정확한 빈 상태 문구,
// 56px 이상 행 높이.

import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";

mockAll();

import Market from "@/pages/Market";
import { INSTRUMENTS } from "@/data/instruments";
import { getClose } from "@/lib/priceEngine";
import { todayKst, addDaysKST } from "@/lib/date";
import { formatNumber } from "@/lib/utils";

function renderMarket() {
  return render(React.createElement(MemoryRouter, null, React.createElement(Market)));
}

const STOCK_COUNT = INSTRUMENTS.filter((it) => it.type === "STOCK").length;
const ETF_COUNT = INSTRUMENTS.filter((it) => it.type === "ETF").length;

function expectedChangeText(symbol: string): string {
  const today = todayKst();
  const prevDay = addDaysKST(today, -1);
  const close = getClose(symbol, today);
  const prevClose = getClose(symbol, prevDay);
  const pct = prevClose === 0 ? 0 : ((close - prevClose) / prevClose) * 100;
  const sign = pct >= 0 ? "+" : "-";
  return `${sign}${Math.abs(pct).toFixed(2)}%`;
}

describe("마켓 화면 (S2) — 목록·탭 필터·검색", () => {
  it("AC-1[P0]: 초기 진입 시 20개 종목 행이 종목명·코드·섹터·종가·등락률과 함께 렌더된다", () => {
    renderMarket();

    expect(STOCK_COUNT + ETF_COUNT).toBe(20);
    expect(screen.getAllByTestId("market-row")).toHaveLength(20);
    expect(screen.queryByText("삼성전자")).not.toBeNull();
    expect(screen.queryByText("005930 · 전기전자")).not.toBeNull();

    const today = todayKst();
    const close = getClose("005930", today);
    expect(screen.getByTestId("market-close-005930").textContent).toBe(`${formatNumber(close)}원`);
    expect(screen.getByTestId("market-change-005930").textContent).toBe(expectedChangeText("005930"));
  });

  it("AC-2[P0]: '주식' 탭 클릭 시 주식 10개만 남는다", () => {
    renderMarket();
    fireEvent.click(screen.getByRole("tab", { name: "주식" }));

    expect(STOCK_COUNT).toBe(10);
    expect(screen.getAllByTestId("market-row")).toHaveLength(STOCK_COUNT);
    expect(screen.queryByText("069500 · 국내지수")).toBeNull();
  });

  it("AC-2[P0]: 'ETF' 탭 10개 → '전체' 탭 클릭 시 20개로 복귀한다", () => {
    renderMarket();
    fireEvent.click(screen.getByRole("tab", { name: "ETF" }));
    expect(ETF_COUNT).toBe(10);
    expect(screen.getAllByTestId("market-row")).toHaveLength(ETF_COUNT);

    fireEvent.click(screen.getByRole("tab", { name: "전체" }));
    expect(screen.getAllByTestId("market-row")).toHaveLength(20);
  });

  it("AC-3[P1]: 검색어 '삼성' 입력 시 이름에 삼성을 포함하는 항목만 2개 이상 남는다", () => {
    renderMarket();
    const input = screen.getByPlaceholderText("삼성전자 또는 005930");
    fireEvent.change(input, { target: { value: "삼성" } });

    const rows = screen.getAllByTestId("market-row");
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("삼성전자")).not.toBeNull();
    expect(screen.queryByText("삼성바이오로직스")).not.toBeNull();
  });

  it("AC-3[P1]: 검색어 '005930' 입력 시 삼성전자 1건만 남는다", () => {
    renderMarket();
    const input = screen.getByPlaceholderText("삼성전자 또는 005930");
    fireEvent.change(input, { target: { value: "005930" } });

    expect(screen.getAllByTestId("market-row")).toHaveLength(1);
    expect(screen.queryByText("삼성전자")).not.toBeNull();
  });

  it("AC-4[P1]: 검색 결과 0건이면 EmptyState('검색 결과가 없어요')가 보인다", () => {
    renderMarket();
    const input = screen.getByPlaceholderText("삼성전자 또는 005930");
    fireEvent.change(input, { target: { value: "존재하지않는종목xyz" } });

    expect(screen.queryByTestId("market-row")).toBeNull();
    const empty = screen.getByTestId("market-empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain("검색 결과가 없어요");
  });

  it("AC-5[P0]: 행 탭 시 주문 화면으로 navigate하고 행 높이가 56px 이상이다", () => {
    renderMarket();
    const row = screen.getAllByTestId("market-row")[0];

    const minHeight = parseInt(row.style.minHeight || getComputedStyle(row).minHeight || "0", 10);
    expect(minHeight).toBeGreaterThanOrEqual(56);

    fireEvent.click(within(row).getByText("삼성전자"));
    expect(mockNavigate).toHaveBeenCalledWith("/trade/005930", {
      state: { symbol: "005930", from: "market" },
    });
  });
});
