
## 퀴즈 채점 규칙 + 리더보드 시드 생성 — fix loop 2026-08-30T18:58:51.988Z
- 시도 횟수: 1
- 트리아지: trivial (1 minor test failures)
- 에러 변화:
  Attempt 1: initial errors — tsc:0|lint:0|test:1
- 비용: $0.1608
- 수정된 파일:
 .ai-factory/shared-context.md     |  83 +++++++++++++++++++-
 src/__tests__/packet-0008.test.ts |   4 +-
 src/lib/leaderboard.ts            | 115 +++++++++++++++++++++++++++
 src/lib/priceEngine.ts            |   4 +-
 src/lib/quiz.ts                   | 161 +++++++++++++++++++++++++++++++++-----
 
