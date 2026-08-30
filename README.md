# MockTradeArena

앱인토스 (Vite + React + TDS) 매일 가상자금으로 모의매매를 하고 내 포트폴리오를 과거 데이터로 백테스트해보는 투자연습 미니앱 실제 돈을 잃을 위험 없이 투자 감각을 기르고 싶지만, 기존 모의투자 앱은 대부분 복잡하거나 무겁다

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Backtest` | Backtest |
| `/BacktestResult` | BacktestResult |
| `/Home` | Home |
| `/Leaderboard` | Leaderboard |
| `/Market` | Market |
| `/Portfolio` | Portfolio |
| `/Quiz` | Quiz |
| `/QuizResult` | QuizResult |
| `/Trade` | Trade |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-08-30
