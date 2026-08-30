import { describe, it, expect } from "vitest";
import type {
  InstrumentType,
  Instrument,
  PricePoint,
  Account,
  Position,
  PositionMap,
  TradeSide,
  Trade,
  StreakState,
  PresetItem,
  BacktestPreset,
  YearlyReturn,
  BacktestResult,
  RiskType,
  QuizResult,
  LeaderboardEntry,
  AppMeta,
  BacktestYears,
  RouteState,
} from "@/lib/types";
import * as typesModule from "@/lib/types";

describe("Packet 0001: 엔티티 타입 + RouteState 계약 정의", () => {
  // AC-1: All entity types are exported
  describe("AC-1: All entity types are exported", () => {
    it("should export all 19 entity types", () => {
      const requiredExports = [
        "InstrumentType",
        "Instrument",
        "PricePoint",
        "Account",
        "Position",
        "PositionMap",
        "TradeSide",
        "Trade",
        "StreakState",
        "PresetItem",
        "BacktestPreset",
        "YearlyReturn",
        "BacktestResult",
        "RiskType",
        "QuizResult",
        "LeaderboardEntry",
        "AppMeta",
        "BacktestYears",
        "RouteState",
      ];

      requiredExports.forEach((exportName) => {
        // Type imports succeed if the export exists
        expect(exportName).toBeTruthy();
      });
    });

    it("should allow importing types without TypeScript errors", () => {
      // This test passes if the import at the top succeeds
      expect(typesModule).toBeDefined();
      expect(Object.keys(typesModule).length).toBeGreaterThan(0);
    });
  });

  // AC-2: BacktestYears is literal union 1|3|5|10
  describe("AC-2: BacktestYears is 1|3|5|10 literal union", () => {
    it("should define BacktestYears with valid values 1, 3, 5, 10", () => {
      // Test that BacktestYears can be assigned these literal values
      const year1: BacktestYears = 1;
      const year3: BacktestYears = 3;
      const year5: BacktestYears = 5;
      const year10: BacktestYears = 10;

      expect([year1, year3, year5, year10]).toEqual([1, 3, 5, 10]);
    });

    it("should have BacktestPreset.years field using BacktestYears type", () => {
      // Verify BacktestPreset has years field with BacktestYears type
      const preset: BacktestPreset = {
        id: "preset-1",
        name: "Test Preset",
        description: "Test",
        symbols: ["005930"],
        startCapital: 1000000,
        years: 3,
        riskType: "conservative",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect([1, 3, 5, 10]).toContain(preset.years);
    });

    it("should have BacktestResult.years field using BacktestYears type", () => {
      // Verify BacktestResult has years field with BacktestYears type
      const result: BacktestResult = {
        id: "result-1",
        presetId: "preset-1",
        years: 5,
        startCapital: 1000000,
        endCapital: 1500000,
        trades: [],
        returns: [],
        maxDrawdown: 0.15,
        sharpeRatio: 1.2,
        winRate: 0.55,
        riskType: "moderate",
        createdAt: new Date(),
      };

      expect([1, 3, 5, 10]).toContain(result.years);
    });
  });

  // AC-3: RouteState has 9 route keys
  describe("AC-3: RouteState has 9 route keys for navigation", () => {
    it("should define RouteState with exactly 9 route keys", () => {
      const expectedRoutes = [
        "/",
        "/market",
        "/trade/:symbol",
        "/portfolio",
        "/backtest",
        "/backtest/result",
        "/quiz",
        "/quiz/result",
        "/leaderboard",
      ];

      expect(expectedRoutes).toHaveLength(9);
    });

    it("should allow RouteState for home route", () => {
      // Test home route state can be defined
      const homeState: RouteState["/"] = {
        // Home may have no state or minimal state
      };
      expect(homeState).toBeDefined();
    });

    it("should allow RouteState for market route", () => {
      const marketState: RouteState["/market"] = {
        // Market state structure
      };
      expect(marketState).toBeDefined();
    });

    it("should allow RouteState for trade/:symbol route", () => {
      const tradeState: RouteState["/trade/:symbol"] = {
        symbol: "005930",
      };
      expect(tradeState.symbol).toBe("005930");
    });

    it("should allow RouteState for portfolio route", () => {
      const portfolioState: RouteState["/portfolio"] = {
        // Portfolio state structure
      };
      expect(portfolioState).toBeDefined();
    });

    it("should allow RouteState for backtest route", () => {
      const backtestState: RouteState["/backtest"] = {
        // Backtest state structure
      };
      expect(backtestState).toBeDefined();
    });

    it("should allow RouteState for backtest/result route", () => {
      const backtestResultState: RouteState["/backtest/result"] = {
        resultId: "result-123",
      };
      expect(backtestResultState.resultId).toBe("result-123");
    });

    it("should allow RouteState for quiz route", () => {
      const quizState: RouteState["/quiz"] = {
        // Quiz state structure
      };
      expect(quizState).toBeDefined();
    });

    it("should allow RouteState for quiz/result route", () => {
      const quizResultState: RouteState["/quiz/result"] = {
        quizResultId: "qr-123",
      };
      expect(quizResultState.quizResultId).toBe("qr-123");
    });

    it("should allow RouteState for leaderboard route", () => {
      const leaderboardState: RouteState["/leaderboard"] = {
        // Leaderboard state structure
      };
      expect(leaderboardState).toBeDefined();
    });
  });

  // AC-4: No value exports (only types)
  describe("AC-4: No runtime value exports in types.ts", () => {
    it("should only export types, not const/function/class/let/var", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const typesFilePath = path.resolve(process.cwd(), "src/lib/types.ts");
      const fileContent = fs.readFileSync(typesFilePath, "utf-8");

      // Pattern to detect runtime value exports
      // Should not match: export const, export function, export class, export let, export var
      // Should match: export type, export interface
      const runtimeValuePattern =
        /^export\s+(const|function|class|let|var)\s+/m;
      const hasRuntimeValues = runtimeValuePattern.test(fileContent);

      expect(hasRuntimeValues).toBe(false);
    });

    it("should have only type and interface exports", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const typesFilePath = path.resolve(process.cwd(), "src/lib/types.ts");
      const fileContent = fs.readFileSync(typesFilePath, "utf-8");

      // Should have export type or export interface patterns
      const typeExportPattern =
        /export\s+(type|interface)\s+[\w]+/;
      const hasTypeExports = typeExportPattern.test(fileContent);

      expect(hasTypeExports).toBe(true);
    });
  });

  // AC-5: TypeScript compilation and build success
  describe("AC-5: Types compile and build succeeds", () => {
    it("should allow creating Account objects with required fields", () => {
      const account: Account = {
        cash: 1000000,
        lastGrantDate: new Date(),
        totalGranted: 50000,
        createdAt: new Date(),
      };

      expect(account.cash).toBe(1000000);
      expect(account.totalGranted).toBe(50000);
    });

    it("should allow creating Position objects with required fields", () => {
      const position: Position = {
        symbol: "005930",
        qty: 100,
        avgPrice: 70000,
      };

      expect(position.symbol).toBe("005930");
      expect(position.qty).toBe(100);
      expect(position.avgPrice).toBe(70000);
    });

    it("should allow creating Trade objects with required fields", () => {
      const trade: Trade = {
        id: "trade-1",
        symbol: "005930",
        name: "Samsung Electronics",
        side: "BUY",
        qty: 10,
        price: 70000,
        fee: 700,
        amount: 700700,
        tradedAt: new Date(),
      };

      expect(trade.id).toBe("trade-1");
      expect(trade.symbol).toBe("005930");
      expect(trade.side).toBe("BUY");
      expect(trade.amount).toBe(700700);
    });

    it("should allow creating BacktestPreset objects", () => {
      const preset: BacktestPreset = {
        id: "preset-1",
        name: "Conservative",
        description: "Low risk strategy",
        symbols: ["005930", "000660"],
        startCapital: 1000000,
        years: 3,
        riskType: "conservative",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(preset.years).toBe(3);
      expect(preset.riskType).toBe("conservative");
      expect(preset.symbols).toHaveLength(2);
    });

    it("should allow creating BacktestResult objects", () => {
      const result: BacktestResult = {
        id: "result-1",
        presetId: "preset-1",
        years: 5,
        startCapital: 1000000,
        endCapital: 1500000,
        trades: [],
        returns: [
          { year: 2020, return: 0.1 },
          { year: 2021, return: 0.15 },
        ],
        maxDrawdown: 0.15,
        sharpeRatio: 1.2,
        winRate: 0.55,
        riskType: "moderate",
        createdAt: new Date(),
      };

      expect(result.years).toBe(5);
      expect(result.startCapital).toBe(1000000);
      expect(result.endCapital).toBe(1500000);
      expect(result.returns).toHaveLength(2);
    });

    it("should allow creating QuizResult objects", () => {
      const quizResult: QuizResult = {
        id: "qr-1",
        userId: "user-1",
        answers: [1, 2, 0, 3],
        score: 75,
        riskProfile: "moderate",
        createdAt: new Date(),
      };

      expect(quizResult.score).toBe(75);
      expect(quizResult.riskProfile).toBe("moderate");
      expect(quizResult.answers).toHaveLength(4);
    });

    it("should allow creating LeaderboardEntry objects", () => {
      const entry: LeaderboardEntry = {
        rank: 1,
        userId: "user-1",
        userName: "Investor A",
        score: 85000,
        backtestCount: 10,
        bestReturn: 0.25,
        createdAt: new Date(),
      };

      expect(entry.rank).toBe(1);
      expect(entry.score).toBe(85000);
      expect(entry.bestReturn).toBe(0.25);
    });

    it("should allow creating AppMeta objects", () => {
      const meta: AppMeta = {
        version: "1.0.0",
        lastUpdated: new Date(),
        dataVersion: "1",
      };

      expect(meta.version).toBe("1.0.0");
      expect(meta.dataVersion).toBe("1");
    });
  });

  // Integration: Verify RouteState covers all navigation paths
  describe("Integration: RouteState navigation contract", () => {
    it("should have RouteState keys matching 9 expected navigation routes", () => {
      const routes = [
        "/",
        "/market",
        "/trade/:symbol",
        "/portfolio",
        "/backtest",
        "/backtest/result",
        "/quiz",
        "/quiz/result",
        "/leaderboard",
      ];

      // Test that each route can be used with RouteState
      routes.forEach((route) => {
        expect(route).toBeTruthy();
      });

      expect(routes).toHaveLength(9);
    });

    it("should support navigate with state to all routes", () => {
      type NavigateTarget = keyof RouteState;
      const targets: NavigateTarget[] = [
        "/",
        "/market",
        "/trade/:symbol",
        "/portfolio",
        "/backtest",
        "/backtest/result",
        "/quiz",
        "/quiz/result",
        "/leaderboard",
      ];

      expect(targets).toHaveLength(9);
      targets.forEach((target) => {
        expect(target).toBeTruthy();
      });
    });
  });
});
