import { useMemo } from 'react';
import { Top, ListRow, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';
import { MiniBar } from '../components/MiniBar';
import { EmptyState } from '../components/StateView';
import { ButtonStack } from '../components/BottomCTA';
import { loadLastBacktest, loadPresets, saveLastBacktest } from '../lib/storage';
import { runBacktest } from '../lib/backtest';
import type { BacktestResult as BacktestResultData } from '../lib/types';

type IncomingState = { presetId?: string } | null;

/** 넘어온 presetId로 다시 계산하고, 없으면 마지막 결과를 복원한다. */
function resolveResult(presetId?: string): BacktestResultData | null {
  if (presetId) {
    const preset = loadPresets().find((p) => p.id === presetId);
    if (preset) {
      const computed = runBacktest(preset);
      if (!('ok' in computed)) {
        saveLastBacktest(computed);
        return computed;
      }
    }
  }
  return loadLastBacktest();
}

export default function BacktestResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as IncomingState;

  const result = useMemo(() => resolveResult(state?.presetId), [state?.presetId]);

  if (!result) {
    return (
      <ScreenScaffold
        top={<Top title={<Top.TitleParagraph>백테스트 리포트</Top.TitleParagraph>} />}
      >
        <EmptyState
          title="아직 계산한 리포트가 없어요"
          description="종목을 담고 백테스트를 먼저 실행해 주세요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate('/backtest')}>
              백테스트 구성하러 가기
            </Button>
          }
          testId="backtest-result-empty"
        />
      </ScreenScaffold>
    );
  }

  const metrics = [
    { key: 'cagr', label: 'CAGR', value: `${result.cagrPct}%` },
    { key: 'mdd', label: '최대 낙폭', value: `${result.mddPct}%` },
    { key: 'sharpe', label: '샤프지수', value: `${result.sharpe}` },
    { key: 'vol', label: '연 변동성', value: `${result.volatilityPct}%` },
  ];
  const worstYear = Math.min(...result.yearly.map((y) => y.returnPct), 0);
  const bestYear = Math.max(...result.yearly.map((y) => y.returnPct), 0);
  const yearSpan = bestYear - worstYear || 1;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>백테스트 리포트</Top.TitleParagraph>} />}
      bottom={
        <ButtonStack
          primary={{ label: '다시 구성하기', onClick: () => navigate('/backtest') }}
          secondary={{ label: '홈으로', onClick: () => navigate('/') }}
        />
      }
    >
      <SummaryHero
        label={`${result.years}년 투자 결과 · 1,000만원 기준`}
        value={<Amount value={result.finalAmount} unit="원" typography="t2" />}
        caption={`총 수익률 ${result.totalReturnPct}%`}
        testId="summary-hero"
      />

      <Spacing size={16} />

      <Card testId="equity-card">
        <Paragraph.Text typography="st11">평가금액 추이</Paragraph.Text>
        <Spacing size={8} />
        <Sparkline data={result.monthlyEquity} testId="equity-sparkline" />
      </Card>

      <Spacing size={16} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {metrics.map((m) => (
          <Card key={m.key} testId="metric-card">
            <ListRow
              contents={<ListRow.Texts type="2RowTypeA" top={m.label} bottom={m.value} />}
            />
          </Card>
        ))}
      </div>

      <Spacing size={16} />

      <Card testId="yearly-card">
        <Paragraph.Text typography="st11">연도별 수익률</Paragraph.Text>
        <Spacing size={12} />
        {result.yearly.map((y) => (
          <div key={y.year}>
            <Paragraph.Text typography="t6">{`${y.year}년 ${y.returnPct}%`}</Paragraph.Text>
            <Spacing size={4} />
            <MiniBar ratio={(y.returnPct - worstYear) / yearSpan} testId="yearly-bar" />
            <Spacing size={12} />
          </div>
        ))}
      </Card>

      <Spacing size={16} />

      <Paragraph.Text typography="st13">
        본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.
      </Paragraph.Text>

      {/* 하단 고정 버튼 여백 */}
      <div style={{ height: 132 }} />
    </ScreenScaffold>
  );
}
