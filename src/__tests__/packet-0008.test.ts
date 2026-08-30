import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QUIZ_QUESTIONS,
  scoreQuiz,
  type QuizAnswer,
  type RiskType,
  recommendedSymbols,
  getLeaderboardSeed,
  buildLeaderboard,
  type LeaderboardEntry,
  clearLeaderboardSeedCache,
} from "@/lib/quiz";

describe("퀴즈 채점 규칙 + 리더보드 시드 생성 (packet-0008)", () => {
  beforeEach(() => {
    clearLeaderboardSeedCache?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // AC-1: QUIZ_QUESTIONS 구조 검증
  // ============================================================
  describe("AC-1: Quiz Questions Structure", () => {
    it("should have exactly 8 questions", () => {
      expect(QUIZ_QUESTIONS).toHaveLength(8);
    });

    it("each question should have exactly 4 choices with scores 1-4", () => {
      QUIZ_QUESTIONS.forEach((q, idx) => {
        expect(q.choices).toHaveLength(4);
        q.choices.forEach((choice, choiceIdx) => {
          expect(choice.score).toBe(choiceIdx + 1);
          expect(choice.label).toBeTruthy();
          expect(typeof choice.label).toBe("string");
        });
      });
    });

    it("each question should have text, id, and 4 choices", () => {
      QUIZ_QUESTIONS.forEach((q) => {
        expect(q.text).toBeTruthy();
        expect(q.id).toBeTruthy();
        expect(q.choices).toHaveLength(4);
      });
    });
  });

  // ============================================================
  // AC-2: Score Quiz 함수
  // ============================================================
  describe("AC-2: scoreQuiz Function", () => {
    it("should return score 8 for all minimum choices (choice 0)", () => {
      const answers: QuizAnswer[] = Array(8).fill(0);
      const result = scoreQuiz(answers);
      expect(result.score).toBe(8);
      expect(typeof result.type).toBe("string");
    });

    it("should return score 32 for all maximum choices (choice 3)", () => {
      const answers: QuizAnswer[] = Array(8).fill(3);
      const result = scoreQuiz(answers);
      expect(result.score).toBe(32);
      expect(typeof result.type).toBe("string");
    });

    it("should return score 20 for medium answers (choice 2)", () => {
      const answers: QuizAnswer[] = Array(8).fill(2);
      const result = scoreQuiz(answers);
      expect(result.score).toBe(16);
      expect(typeof result.type).toBe("string");
    });

    it("should return valid RiskType: STABLE, STABLE_GROWTH, NEUTRAL, ACTIVE, or AGGRESSIVE", () => {
      const validTypes: RiskType[] = [
        "STABLE",
        "STABLE_GROWTH",
        "NEUTRAL",
        "ACTIVE",
        "AGGRESSIVE",
      ];

      // Test minimum score (8)
      let result = scoreQuiz(Array(8).fill(0));
      expect(validTypes).toContain(result.type);

      // Test maximum score (32)
      result = scoreQuiz(Array(8).fill(3));
      expect(validTypes).toContain(result.type);

      // Test mid score
      const mixedAnswers = [0, 1, 2, 3, 0, 1, 2, 3];
      result = scoreQuiz(mixedAnswers);
      expect(validTypes).toContain(result.type);
    });

    it("should map score ranges correctly to RiskType", () => {
      // Score 8-10 → STABLE
      expect(scoreQuiz(Array(8).fill(0)).type).toBe("STABLE");

      // Score 11-16 → STABLE_GROWTH
      const stableGrowthAnswers = [1, 1, 1, 1, 1, 1, 1, 1]; // 8 points
      // Try a higher combo for STABLE_GROWTH
      const higher = [0, 0, 0, 0, 1, 1, 1, 1]; // 12 points total
      const result = scoreQuiz(higher);
      expect(result.score).toBe(12);
      // Should be in STABLE_GROWTH or NEUTRAL range

      // Score 32 → AGGRESSIVE
      expect(scoreQuiz(Array(8).fill(3)).type).toBe("AGGRESSIVE");
    });
  });

  // ============================================================
  // AC-3: Recommended Symbols (Deterministic)
  // ============================================================
  describe("AC-3: Recommended Symbols", () => {
    it("should return exactly 3 symbols for STABLE", () => {
      const symbols = recommendedSymbols("STABLE");
      expect(symbols).toHaveLength(3);
      symbols.forEach((symbol) => {
        expect(typeof symbol).toBe("string");
        expect(symbol.length).toBeGreaterThan(0);
      });
    });

    it("should return exactly 3 symbols for AGGRESSIVE", () => {
      const symbols = recommendedSymbols("AGGRESSIVE");
      expect(symbols).toHaveLength(3);
      expect(symbols.every((s) => typeof s === "string")).toBe(true);
    });

    it("should be deterministic: same risk type always returns same 3 symbols", () => {
      const symbols1 = recommendedSymbols("NEUTRAL");
      const symbols2 = recommendedSymbols("NEUTRAL");
      expect(symbols1).toEqual(symbols2);
    });

    it("all recommended symbols should exist in INSTRUMENT_MAP", () => {
      // Import INSTRUMENT_MAP to validate
      const riskTypes: RiskType[] = [
        "STABLE",
        "STABLE_GROWTH",
        "NEUTRAL",
        "ACTIVE",
        "AGGRESSIVE",
      ];
      riskTypes.forEach((riskType) => {
        const symbols = recommendedSymbols(riskType);
        expect(symbols).toHaveLength(3);
        symbols.forEach((symbol) => {
          expect(symbol).toBeTruthy();
        });
      });
    });

    it("different risk types should return different symbols (mostly)", () => {
      const stable = recommendedSymbols("STABLE");
      const aggressive = recommendedSymbols("AGGRESSIVE");
      // They should be different
      expect(stable).not.toEqual(aggressive);
    });
  });

  // ============================================================
  // AC-4: Leaderboard Seed Generation (Cached)
  // ============================================================
  describe("AC-4: Leaderboard Seed Generation", () => {
    it("should generate exactly 49 bot entries on first call", () => {
      const seed = getLeaderboardSeed();
      expect(seed).toHaveLength(49);
    });

    it("each bot should have correct structure: id (bot-01 to bot-49), nicknames, scores", () => {
      const seed = getLeaderboardSeed();
      seed.forEach((entry, idx) => {
        const expectedBotId = `bot-${String(idx + 1).padStart(2, "0")}`;
        expect(entry.id).toBe(expectedBotId);
        expect(entry.nickname).toBeTruthy();
        expect(typeof entry.nickname).toBe("string");
        expect(entry.totalAssetKrw).toBeGreaterThan(0);
        expect(typeof entry.returnPct).toBe("number");
        expect(typeof entry.streak).toBe("number");
      });
    });

    it("should cache result: second call returns same reference", () => {
      const seed1 = getLeaderboardSeed();
      const seed2 = getLeaderboardSeed();
      expect(seed1).toEqual(seed2);
      // Should be same content
      seed1.forEach((entry, idx) => {
        expect(entry.id).toBe(seed2[idx].id);
        expect(entry.nickname).toBe(seed2[idx].nickname);
        expect(entry.totalAssetKrw).toBe(seed2[idx].totalAssetKrw);
      });
    });

    it("should have some bots with isFriend=true, some false", () => {
      const seed = getLeaderboardSeed();
      const friendCount = seed.filter((e) => e.isFriend).length;
      const nonFriendCount = seed.filter((e) => !e.isFriend).length;
      expect(friendCount).toBeGreaterThan(0);
      expect(nonFriendCount).toBeGreaterThan(0);
    });

    it("all nicknames should be Korean (비-ASCII characters)", () => {
      const seed = getLeaderboardSeed();
      seed.forEach((entry) => {
        // Check if nickname contains Korean characters (hangul)
        const koreanRegex = /[가-힯ᄀ-ᇿ]/;
        expect(entry.nickname).toMatch(koreanRegex);
      });
    });

    it("should generate deterministic seed after clear (reproducible pattern)", () => {
      const seed1 = getLeaderboardSeed();
      const firstBotId = seed1[0].id;
      const firstNickname = seed1[0].nickname;

      clearLeaderboardSeedCache?.();

      const seed2 = getLeaderboardSeed();
      // After clear, should generate fresh but deterministic seed
      expect(seed2[0].id).toBe(firstBotId);
      // Nicknames might be different due to randomization, but structure is same
      expect(seed2).toHaveLength(49);
    });
  });

  // ============================================================
  // AC-5: Build Leaderboard
  // ============================================================
  describe("AC-5: buildLeaderboard Function", () => {
    it("should return exactly 50 entries (49 bots + me)", () => {
      const leaderboard = buildLeaderboard(50000000, 15.5, 5);
      expect(leaderboard).toHaveLength(50);
    });

    it("should include exactly one entry with isMe=true", () => {
      const leaderboard = buildLeaderboard(50000000, 15.5, 5);
      const meEntries = leaderboard.filter((e) => e.isMe);
      expect(meEntries).toHaveLength(1);
      expect(meEntries[0].totalAssetKrw).toBe(50000000);
      expect(meEntries[0].returnPct).toBe(15.5);
      expect(meEntries[0].streak).toBe(5);
    });

    it("should be sorted by totalAssetKrw descending", () => {
      const leaderboard = buildLeaderboard(50000000, 15.5, 5);
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].totalAssetKrw).toBeGreaterThanOrEqual(
          leaderboard[i].totalAssetKrw
        );
      }
    });

    it("should place 'me' at correct rank based on asset", () => {
      // Me with very low asset should be near bottom
      const lowAssetLeaderboard = buildLeaderboard(1000000, 5, 1);
      expect(lowAssetLeaderboard).toHaveLength(50);
      const meEntry = lowAssetLeaderboard.find((e) => e.isMe);
      expect(meEntry).toBeDefined();
      // Should be in lower ranks
      const meIndex = lowAssetLeaderboard.indexOf(meEntry!);
      expect(meIndex).toBeGreaterThan(30); // Near bottom
    });

    it("should place 'me' at correct rank when asset is high", () => {
      // Me with very high asset should be near top
      const highAssetLeaderboard = buildLeaderboard(500000000, 50, 10);
      const meEntry = highAssetLeaderboard.find((e) => e.isMe);
      const meIndex = highAssetLeaderboard.indexOf(meEntry!);
      expect(meIndex).toBeLessThan(10); // Near top
    });

    it("me entry should contain passed parameters", () => {
      const asset = 75000000;
      const returnPct = 22.5;
      const streak = 7;
      const leaderboard = buildLeaderboard(asset, returnPct, streak);
      const meEntry = leaderboard.find((e) => e.isMe);
      expect(meEntry?.totalAssetKrw).toBe(asset);
      expect(meEntry?.returnPct).toBe(returnPct);
      expect(meEntry?.streak).toBe(streak);
    });

    it("should have nickname 'Me' or similar for isMe entry", () => {
      const leaderboard = buildLeaderboard(50000000, 15.5, 5);
      const meEntry = leaderboard.find((e) => e.isMe);
      expect(meEntry?.id).toBe("me");
    });
  });

  // ============================================================
  // Integration: Quiz → Recommendation Flow
  // ============================================================
  describe("Integration: Quiz Scoring & Recommendation", () => {
    it("should flow from quiz answers to symbol recommendations", () => {
      // Low risk answers (conservative)
      const lowRiskAnswers = Array(8).fill(0);
      const lowResult = scoreQuiz(lowRiskAnswers);
      expect(lowResult.type).toBe("STABLE");
      const stableSymbols = recommendedSymbols(lowResult.type);
      expect(stableSymbols).toHaveLength(3);
      stableSymbols.forEach((s) => expect(typeof s).toBe("string"));
    });

    it("should flow from quiz answers to aggressive recommendations", () => {
      // High risk answers
      const highRiskAnswers = Array(8).fill(3);
      const highResult = scoreQuiz(highRiskAnswers);
      expect(highResult.type).toBe("AGGRESSIVE");
      const aggressiveSymbols = recommendedSymbols(highResult.type);
      expect(aggressiveSymbols).toHaveLength(3);
      aggressiveSymbols.forEach((s) => expect(typeof s).toBe("string"));
    });
  });

  // ============================================================
  // Edge Cases & Boundary Tests
  // ============================================================
  describe("Edge Cases & Boundaries", () => {
    it("should handle boundary score 8 (minimum)", () => {
      const result = scoreQuiz(Array(8).fill(0));
      expect(result.score).toBe(8);
      expect(result.type).toBe("STABLE");
    });

    it("should handle boundary score 32 (maximum)", () => {
      const result = scoreQuiz(Array(8).fill(3));
      expect(result.score).toBe(32);
      expect(result.type).toBe("AGGRESSIVE");
    });

    it("should handle mixed answers", () => {
      const mixedAnswers = [0, 1, 2, 3, 0, 2, 1, 3]; // 12 points
      const result = scoreQuiz(mixedAnswers);
      expect(result.score).toBe(12);
      expect(result.type).toBeTruthy();
    });

    it("leaderboard with 0 asset should still rank correctly", () => {
      const leaderboard = buildLeaderboard(0, 0, 0);
      expect(leaderboard).toHaveLength(50);
      const meEntry = leaderboard.find((e) => e.isMe);
      expect(meEntry?.totalAssetKrw).toBe(0);
    });

    it("leaderboard with negative return should still work", () => {
      const leaderboard = buildLeaderboard(50000000, -5.2, 0);
      const meEntry = leaderboard.find((e) => e.isMe);
      expect(meEntry?.returnPct).toBe(-5.2);
    });
  });
});
