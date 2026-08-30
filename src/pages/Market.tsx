import { useMemo, useState } from 'react';
import { Top, TextField, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { EmptyState } from '../components/StateView';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { INSTRUMENTS } from '../data/instruments';
import { getClose } from '../lib/priceEngine';
import { todayKst } from '../lib/date';
import { formatNumber } from '../lib/utils';

/** 시세는 결정적 엔진이 계산한다 — 실패해도 화면이 죽지 않게 0으로 degrade. */
function priceOf(symbol: string, day: string): number {
  try {
    return getClose(symbol, day);
  } catch {
    return 0;
  }
}

export default function Market() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const today = todayKst();

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return INSTRUMENTS.filter(
      (it) =>
        keyword === '' ||
        it.name.toLowerCase().includes(keyword) ||
        it.symbol.includes(keyword),
    ).map((it) => ({ ...it, close: priceOf(it.symbol, today) }));
  }, [query, today]);

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

      {rows.length === 0 ? (
        <EmptyState
          title="찾는 종목이 없어요"
          description="종목명이나 6자리 코드를 다시 확인해 주세요"
          testId="market-empty"
        />
      ) : (
        <div data-testid="market-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row) => (
            <Card key={row.symbol} testId="market-row">
              <ListRow
                onClick={() => navigate(`/trade/${row.symbol}`, { state: { symbol: row.symbol, from: 'market' } })}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={row.name}
                    bottom={`${row.symbol} · ${row.sector}`}
                  />
                }
                right={<Paragraph.Text typography="t6">{`${formatNumber(row.close)}원`}</Paragraph.Text>}
              />
            </Card>
          ))}
        </div>
      )}

      {/* 하단 고정 탭바에 마지막 행이 가리지 않도록 여백 */}
      <div style={{ height: 88 }} />
    </ScreenScaffold>
  );
}
