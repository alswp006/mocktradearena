import { useMemo, useState } from 'react';
import { Top, TextField, Tab, ListRow, Paragraph, Badge, Spacing } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';
import { EmptyState } from '../components/StateView';
import { AdSection } from '../components/AdSection';
import { DisclaimerNotice } from '../components/DisclaimerNotice';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { INSTRUMENTS } from '../data/instruments';
import { getClose, getDailySeries } from '../lib/priceEngine';
import { todayKst, addDaysKST } from '../lib/date';
import { formatNumber } from '../lib/utils';
import type { InstrumentType } from '../lib/types';

const TABS: Array<{ label: string; type: InstrumentType | null }> = [
  { label: '전체', type: null },
  { label: '주식', type: 'STOCK' },
  { label: 'ETF', type: 'ETF' },
];

const SPARKLINE_DAYS = 60;

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
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function Market() {
  const navigate = useNavigate();
  const [tabIndex, setTabIndex] = useState(0);
  const [query, setQuery] = useState('');
  const today = todayKst();
  const prevDay = addDaysKST(today, -1);

  const rows = useMemo(() => {
    const activeType = TABS[tabIndex]?.type ?? null;
    const keyword = query.trim().toLowerCase();

    return INSTRUMENTS.filter((it) => activeType === null || it.type === activeType)
      .filter(
        (it) =>
          keyword === '' ||
          it.name.toLowerCase().includes(keyword) ||
          it.symbol.includes(keyword),
      )
      .map((it) => {
        const close = priceOf(it.symbol, today);
        const prevClose = priceOf(it.symbol, prevDay);
        const changePct = prevClose === 0 ? 0 : ((close - prevClose) / prevClose) * 100;
        const trend = getDailySeries(it.symbol)
          .slice(-SPARKLINE_DAYS)
          .map((p) => p.close);
        return { ...it, close, changePct, trend };
      });
  }, [tabIndex, query, today, prevDay]);

  function goTrade(symbol: string) {
    haptic();
    navigate(`/trade/${symbol}`, { state: { symbol, from: 'market' } });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>마켓</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={MAIN_TAB_ITEMS} />}
    >
      <TextField
        variant="box"
        label="종목 검색"
        placeholder="삼성전자 또는 005930"
        value={query}
        inputMode="text"
        enterKeyHint="search"
        onChange={(e) => setQuery(e.target.value)}
      />

      <Spacing size={16} />

      <Tab
        onChange={(index: number) => {
          haptic();
          setTabIndex(index);
        }}
      >
        {TABS.map((tab, index) => (
          <Tab.Item key={tab.label} selected={tabIndex === index}>
            {tab.label}
          </Tab.Item>
        ))}
      </Tab>

      <Spacing size={12} />

      {rows.length === 0 ? (
        <EmptyState
          title="검색 결과가 없어요"
          description="다른 종목명이나 코드로 찾아보세요"
          testId="market-empty"
        />
      ) : (
        <div data-testid="market-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row) => (
            <Card key={row.symbol} testId="market-row" style={{ minHeight: 56, padding: 0 }}>
              <ListRow
                onClick={() => goTrade(row.symbol)}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={row.name}
                    bottom={`${row.symbol} · ${row.sector}`}
                  />
                }
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 48 }}>
                      <Sparkline data={row.trend} width={48} height={28} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <Paragraph.Text typography="t6" data-testid={`market-close-${row.symbol}`}>
                        {`${formatNumber(row.close)}원`}
                      </Paragraph.Text>
                      <div data-testid={`market-change-${row.symbol}`}>
                        <Badge size="small" variant="weak" color={row.changePct >= 0 ? 'red' : 'blue'}>
                          {`${row.changePct >= 0 ? '+' : '-'}${Math.abs(row.changePct).toFixed(2)}%`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                }
              />
            </Card>
          ))}
        </div>
      )}

      <AdSection />

      <DisclaimerNotice />

      {/* 하단 고정 탭바에 마지막 행이 가리지 않도록 여백 */}
      <div style={{ height: 88 }} />
    </ScreenScaffold>
  );
}
