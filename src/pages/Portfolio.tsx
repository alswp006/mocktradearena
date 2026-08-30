import { useMemo, useState } from 'react';
import { Top, Tab, ListRow, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { MiniBar } from '../components/MiniBar';
import { EmptyState } from '../components/StateView';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { useAppState } from '../store/AppStateContext';
import { getInstrument } from '../data/instruments';
import { getClose } from '../lib/priceEngine';
import { todayKst } from '../lib/date';
import { formatNumber } from '../lib/utils';

function priceOf(symbol: string, day: string): number {
  try {
    return getClose(symbol, day);
  } catch {
    return 0;
  }
}

export default function Portfolio() {
  const navigate = useNavigate();
  const { account, positions, trades, totalAsset } = useAppState();
  const [tabIndex, setTabIndex] = useState(0);
  const today = todayKst();

  const rows = useMemo(() => {
    return Object.values(positions)
      .map((p) => {
        const close = priceOf(p.symbol, today);
        const evalAmount = p.qty * close;
        const cost = p.qty * p.avgPrice;
        return {
          ...p,
          name: getInstrument(p.symbol)?.name ?? p.symbol,
          evalAmount,
          pnl: evalAmount - cost,
        };
      })
      .sort((a, b) => b.evalAmount - a.evalAmount);
  }, [positions, today]);

  const holdingsValue = rows.reduce((sum, r) => sum + r.evalAmount, 0);
  const recentTrades = useMemo(() => [...trades].reverse().slice(0, 30), [trades]);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>포트폴리오</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={MAIN_TAB_ITEMS} />}
    >
      <SummaryHero
        label="총 평가자산"
        value={<Amount value={totalAsset} unit="원" typography="t2" />}
        caption={`현금 ${formatNumber(account.cash)}원 · 보유 ${formatNumber(holdingsValue)}원`}
        testId="portfolio-hero"
      />

      <Spacing size={16} />

      <Tab onChange={(index: number) => setTabIndex(index)}>
        <Tab.Item selected={tabIndex === 0}>보유종목</Tab.Item>
        <Tab.Item selected={tabIndex === 1}>거래내역</Tab.Item>
      </Tab>

      <Spacing size={16} />

      {tabIndex === 0 &&
        (rows.length === 0 ? (
          <EmptyState
            title="아직 보유 종목이 없어요"
            description="마켓에서 첫 종목을 골라 보세요"
            action={
              <Button variant="weak" display="block" onClick={() => navigate('/market', { state: { from: 'portfolio' } })}>
                마켓 둘러보기
              </Button>
            }
            testId="portfolio-empty"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => (
              <Card key={row.symbol} testId="portfolio-position-card">
                <ListRow
                  onClick={() => navigate(`/trade/${row.symbol}`, { state: { symbol: row.symbol, from: 'portfolio' } })}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={row.name}
                      bottom={`${row.qty}주 · 평균 ${formatNumber(row.avgPrice)}원`}
                    />
                  }
                  right={
                    <Paragraph.Text typography="t6">
                      {`${formatNumber(row.evalAmount)}원`}
                    </Paragraph.Text>
                  }
                />
                <Spacing size={8} />
                <MiniBar ratio={holdingsValue === 0 ? 0 : row.evalAmount / holdingsValue} />
              </Card>
            ))}
          </div>
        ))}

      {tabIndex === 1 &&
        (recentTrades.length === 0 ? (
          <EmptyState
            title="아직 거래 내역이 없어요"
            description="매수·매도를 하면 여기에 쌓여요"
            testId="portfolio-history-empty"
          />
        ) : (
          <Card testId="portfolio-history-card">
            {recentTrades.map((t) => (
              <ListRow
                key={t.id}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={`${t.name} ${t.side === 'BUY' ? '매수' : '매도'} ${t.qty}주`}
                    bottom={`${formatNumber(t.price)}원 · 수수료 ${formatNumber(t.fee)}원`}
                  />
                }
              />
            ))}
          </Card>
        ))}

      {/* 하단 고정 탭바 여백 */}
      <div style={{ height: 88 }} />
    </ScreenScaffold>
  );
}
