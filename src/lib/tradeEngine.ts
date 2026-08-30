// 매수/매도 체결 엔진 — 현금·보유수량 검증, 수수료(+세금) 계산, 평균단가 갱신.
// 순수 로직: account.cash와 positions Map을 in-place로 갱신하고 체결 결과만 반환한다.
// 수수료 산식은 spec.md F4 기준 — 매도에는 거래세(0.18%)가 추가로 붙는다.

import { getKSTDate } from "@/lib/date";

export type TradeType = "BUY" | "SELL";

export interface TradeRequest {
  type: TradeType;
  symbol: string;
  quantity: number;
  price: number;
}

export interface TradePosition {
  quantity: number;
  avgPrice: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  type: TradeType;
  quantity: number;
  price: number;
  fee: number;
  amount: number;
  timestamp: string;
}

export interface TradeAccount {
  cash: number;
  [key: string]: any;
}

export interface TradeResult {
  ok: boolean;
  reason?: "INSUFFICIENT_CASH" | "INSUFFICIENT_QTY";
  trade?: TradeRecord;
}

const BUY_FEE_RATE = 0.00015;
const SELL_TAX_RATE = 0.0018;

function buyFee(amount: number): number {
  return Math.floor(amount * BUY_FEE_RATE);
}

function sellFee(amount: number): number {
  return Math.floor(amount * BUY_FEE_RATE) + Math.floor(amount * SELL_TAX_RATE);
}

let tradeSeq = 0;
function nextTradeId(): string {
  tradeSeq += 1;
  return `trade-${Date.now()}-${tradeSeq}`;
}

export function executeTrade(
  account: TradeAccount,
  positions: Map<string, TradePosition>,
  request: TradeRequest,
  trades?: TradeRecord[]
): TradeResult {
  const amount = request.quantity * request.price;

  if (request.type === "BUY") {
    const fee = buyFee(amount);
    const totalCost = amount + fee;
    if (account.cash < totalCost) {
      return { ok: false, reason: "INSUFFICIENT_CASH" };
    }

    const existing = positions.get(request.symbol) ?? { quantity: 0, avgPrice: 0 };
    const newQuantity = existing.quantity + request.quantity;
    const newAvgPrice = Math.floor(
      (existing.quantity * existing.avgPrice + request.quantity * request.price) / newQuantity
    );

    account.cash = Math.floor(account.cash - totalCost);
    positions.set(request.symbol, { quantity: newQuantity, avgPrice: newAvgPrice });

    const trade: TradeRecord = {
      id: nextTradeId(),
      symbol: request.symbol,
      type: "BUY",
      quantity: request.quantity,
      price: request.price,
      fee,
      amount,
      timestamp: getKSTDate(),
    };
    trades?.push(trade);
    return { ok: true, trade };
  }

  // SELL
  const existing = positions.get(request.symbol);
  if (!existing || existing.quantity < request.quantity) {
    return { ok: false, reason: "INSUFFICIENT_QTY" };
  }

  const fee = sellFee(amount);
  const proceeds = amount - fee;
  const remainingQty = existing.quantity - request.quantity;

  account.cash = Math.floor(account.cash + proceeds);
  if (remainingQty === 0) {
    positions.delete(request.symbol);
  } else {
    positions.set(request.symbol, { quantity: remainingQty, avgPrice: existing.avgPrice });
  }

  const trade: TradeRecord = {
    id: nextTradeId(),
    symbol: request.symbol,
    type: "SELL",
    quantity: request.quantity,
    price: request.price,
    fee,
    amount,
    timestamp: getKSTDate(),
  };
  trades?.push(trade);
  return { ok: true, trade };
}
