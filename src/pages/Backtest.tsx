import { useState } from 'react';
import { Top, ListRow, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { SubmitFooter } from '../components/BottomCTA';
import { INSTRUMENTS } from '../data/instruments';
import { loadPresets, savePresets } from '../lib/storage';
import { getKSTDate } from '../lib/date';
import type { BacktestPreset, BacktestYears, PresetItem } from '../lib/types';

const YEAR_OPTIONS: BacktestYears[] = [1, 3, 5, 10];
const MAX_ITEMS = 5;

/** 선택 종목에 정수 비중을 균등 배분한다(합계는 항상 100). */
function equalWeights(symbols: string[]): PresetItem[] {
  const base = Math.floor(100 / symbols.length);
  return symbols.map((symbol, index) => ({
    symbol,
    weight: index === 0 ? 100 - base * (symbols.length - 1) : base,
  }));
}

export default function Backtest() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [years, setYears] = useState<BacktestYears>(3);
  const [error, setError] = useState<string | null>(null);

  const toggle = (symbol: string) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(symbol)) return prev.filter((s) => s !== symbol);
      if (prev.length >= MAX_ITEMS) {
        setError('종목은 최대 5개까지 담을 수 있어요');
        return prev;
      }
      return [...prev, symbol];
    });
  };

  const run = () => {
    if (selected.length === 0) {
      setError('종목을 1개 이상 골라 주세요');
      return;
    }
    const preset: BacktestPreset = {
      id: `p-${Date.now().toString(36)}`,
      name: `${selected.length}종목 ${years}년`,
      items: equalWeights(selected),
      years,
      createdAt: getKSTDate(),
    };
    savePresets([...loadPresets(), preset]);
    navigate('/backtest/result', { state: { presetId: preset.id, years } });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>백테스트</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter label="백테스트 실행하기" onClick={run} disabled={selected.length === 0} />
      }
    >
      <Card testId="backtest-summary-card">
        <Paragraph.Text typography="st11">담은 종목</Paragraph.Text>
        <Spacing size={4} />
        <Paragraph.Text typography="t3">{`${selected.length} / ${MAX_ITEMS}개`}</Paragraph.Text>
        <Spacing size={8} />
        <Paragraph.Text typography="t6">
          {selected.length === 0
            ? '1,000만원을 균등 배분해 과거 수익률을 계산해요'
            : `비중은 균등 배분돼요 · 기간 ${years}년`}
        </Paragraph.Text>
        {error ? (
          <>
            <Spacing size={8} />
            <Paragraph.Text typography="st13">{error}</Paragraph.Text>
          </>
        ) : null}
      </Card>

      <Spacing size={20} />

      <Paragraph.Text typography="t4">기간</Paragraph.Text>
      <Spacing size={12} />
      <div style={{ display: 'flex', gap: 8 }}>
        {YEAR_OPTIONS.map((y) => (
          <Button
            key={y}
            variant={years === y ? 'fill' : 'weak'}
            onClick={() => setYears(y)}
          >
            {`${y}년`}
          </Button>
        ))}
      </div>

      <Spacing size={20} />

      <Paragraph.Text typography="t4">종목 고르기</Paragraph.Text>
      <Spacing size={12} />
      <Card testId="backtest-instrument-list">
        {INSTRUMENTS.map((it) => (
          <ListRow
            key={it.symbol}
            onClick={() => toggle(it.symbol)}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={it.name}
                bottom={`${it.symbol} · ${it.sector}`}
              />
            }
            right={
              <Paragraph.Text typography="t6">
                {selected.includes(it.symbol) ? '담음' : '담기'}
              </Paragraph.Text>
            }
          />
        ))}
      </Card>

      {/* 하단 고정 CTA 여백 */}
      <div style={{ height: 120 }} />
    </ScreenScaffold>
  );
}
