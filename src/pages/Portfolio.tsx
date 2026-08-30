import { useMemo, useState } from 'react';
import { Top, Tab, ListRow, Button, Paragraph, Spacing, Badge, Chip } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { EmptyState } from '../components/StateView';
import { TradeHistoryTab } from '../components/TradeHistoryTab';
import { AdSection } from '../components/AdSection';
import { DisclaimerNotice } from '../components/DisclaimerNotice';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { useAppState } from '../store/AppStateContext';
import { getInstrument } from '../data/instruments';
import { getClose } from '../lib/priceEngine';
import { todayKst } from '../lib/date';
import { formatNumber } from '../lib/utils';
import type { RouteState } from '../lib/types';

/** 시세는 결정적 엔진이 계산한다 — 실패해도 화면이 죽지 않게 0으로 degrade. */
function priceOf(symbol: string, day: string): number {
  try {
    return getClose(symbol, day);
  } catch {
    return 0;
  }
}

function haptic() {
  try {
    Promise.resolve(generateHapticFeedback({ type: 'tickWeak' })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Portfolio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { account, positions, trades } = useAppState();
  const [tabIndex, setTabIndex] = useState(0);
  const today = todayKst();

  const justTradedSymbol = ((location.state as RouteState['/portfolio']) ?? null)?.justTradedSymbol;

  const rows = useMemo(() => {
    return Object.values(positions)
      .flatMap((p) => {
        const instrument = getInstrument(p.symbol);
        if (!instrument) return []; // 마스터에 없는 심볼은 무음 필터링
        const close = priceOf(p.symbol, today);
        const evalAmount = p.qty * close;
        const cost = p.qty * p.avgPrice;
        const pnl = evalAmount - cost;
        const pnlPct = cost === 0 ? 0 : (pnl / cost) * 100;
        return [{ ...p, name: instrument.name, evalAmount, pnl, pnlPct }];
      })
      .sort((a, b) => b.evalAmount - a.evalAmount);
  }, [positions, today]);

  const holdingsValue = rows.reduce((sum, r) => sum + r.evalAmount, 0);
  const totalAsset = account.cash + holdingsValue;
  const totalPnl = rows.reduce((sum, r) => sum + r.pnl, 0);

  function goMarket() {
    haptic();
    navigate('/market', { state: { from: 'portfolio' } });
  }

  function goTrade(symbol: string) {
    haptic();
    navigate(`/trade/${symbol}`, { state: { symbol, from: 'portfolio' } });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>포트폴리오</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={MAIN_TAB_ITEMS} />}
    >
      <SummaryHero
        label="총 평가자산"
        value={<Amount value={totalAsset} unit="원" typography="t2" />}
        caption={`현금 ${formatNumber(account.cash)}원 · 평가손익 ${totalPnl >= 0 ? '+' : ''}${formatNumber(totalPnl)}원`}
        testId="portfolio-hero"
      />

      <Spacing size={20} />

      <Tab onChange={(index: number) => { haptic(); setTabIndex(index); }}>
        <Tab.Item selected={tabIndex === 0}>보유종목</Tab.Item>
        <Tab.Item selected={tabIndex === 1}>거래내역</Tab.Item>
      </Tab>

      <Spacing size={12} />

      {tabIndex === 0 &&
        (rows.length === 0 ? (
          <EmptyState
            title="아직 보유 종목이 없어요"
            description="마켓에서 첫 종목을 골라 보세요"
            action={
              <Button variant="weak" display="block" onClick={goMarket}>
                마켓 둘러보기
              </Button>
            }
            testId="portfolio-empty"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => {
              const highlighted = row.symbol === justTradedSymbol;
              return (
                <div
                  key={row.symbol}
                  data-testid="portfolio-position-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => goTrade(row.symbol)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') goTrade(row.symbol);
                  }}
                >
                  <Card>
                    {highlighted ? (
                      <>
                        <Chip>방금 거래</Chip>
                        <Spacing size={4} />
                      </>
                    ) : null}
                    <ListRow
                      contents={
                        <ListRow.Texts
                          type="2RowTypeA"
                          top={row.name}
                          bottom={`${row.qty}주 · 평균 ${formatNumber(row.avgPrice)}원`}
                        />
                      }
                      right={
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <Paragraph.Text typography="t6">
                            {`${formatNumber(row.evalAmount)}원`}
                          </Paragraph.Text>
                          <Badge size="small" variant="weak" color={row.pnlPct >= 0 ? 'red' : 'blue'}>
                            {`${row.pnlPct >= 0 ? '+' : ''}${row.pnlPct.toFixed(2)}%`}
                          </Badge>
                        </div>
                      }
                    />
                  </Card>
                </div>
              );
            })}
          </div>
        ))}

      {tabIndex === 1 && <TradeHistoryTab trades={trades} onGoMarket={goMarket} />}

      <AdSection />

      <DisclaimerNotice />

      {/* 하단 고정 탭바에 마지막 요소가 가리지 않도록 여백 */}
      <div style={{ height: 88 }} />
    </ScreenScaffold>
  );
}
