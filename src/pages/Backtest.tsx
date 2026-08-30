import { useEffect, useState } from 'react';
import { Top, TextField, Chip, ChipItem, ListRow, Button, Paragraph, Spacing, Toast } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { SubmitFooter } from '../components/BottomCTA';
import { EmptyState } from '../components/StateView';
import { INSTRUMENTS, getInstrument } from '../data/instruments';
import { loadPresets, savePresets } from '../lib/storage';
import { getKSTDate } from '../lib/date';
import type { BacktestPreset, BacktestYears, PresetItem } from '../lib/types';

const YEAR_OPTIONS: BacktestYears[] = [1, 3, 5, 10];
const MAX_ITEMS = 5;
const TOAST_MAX_ITEMS = '최대 5개까지 담을 수 있어요';

function fireHaptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

function nextPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizedName(raw: string, years: BacktestYears, count: number): string {
  const trimmed = raw.trim().slice(0, 20);
  return trimmed.length > 0 ? trimmed : `${count}종목 · ${years}년`;
}

export default function Backtest() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [items, setItems] = useState<PresetItem[]>([]);
  const [years, setYears] = useState<BacktestYears>(3);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [presets, setPresets] = useState<BacktestPreset[]>(() => loadPresets());

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 2400);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const sum = items.reduce((acc, it) => acc + (Number.isFinite(it.weight) ? it.weight : 0), 0);
  const canRun = items.length > 0 && sum === 100;

  const toggle = (symbol: string) => {
    setItems((prev) => {
      if (prev.some((it) => it.symbol === symbol)) {
        return prev.filter((it) => it.symbol !== symbol);
      }
      if (prev.length >= MAX_ITEMS) {
        setToastMsg(TOAST_MAX_ITEMS);
        return prev;
      }
      fireHaptic('tickWeak');
      return [...prev, { symbol, weight: 0 }];
    });
  };

  const setWeight = (symbol: string, raw: string) => {
    const parsed = raw === '' ? 0 : Math.trunc(Number(raw));
    const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
    setItems((prev) => prev.map((it) => (it.symbol === symbol ? { ...it, weight: safe } : it)));
  };

  const run = () => {
    if (!canRun) return;
    const preset: BacktestPreset = {
      id: nextPresetId(),
      name: normalizedName(name, years, items.length),
      items,
      years,
      createdAt: getKSTDate(),
    };
    savePresets([...loadPresets(), preset]);
    setPresets(loadPresets());
    navigate('/backtest/result', { state: { presetId: preset.id, years } });
  };

  const runPreset = (preset: BacktestPreset) => {
    fireHaptic('tickWeak');
    navigate('/backtest/result', { state: { presetId: preset.id, years: preset.years } });
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    savePresets(updated);
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>백테스트</Top.TitleParagraph>} />}
      bottom={<SubmitFooter label="백테스트 실행하기" onClick={run} disabled={!canRun} />}
    >
      <TextField
        variant="box"
        label="포트폴리오 이름"
        placeholder="예: 성장주 5종목"
        help="1~20자로 지어주세요"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 20))}
      />

      <Spacing size={20} />

      <Paragraph.Text typography="t4">{`종목 선택 (최대 ${MAX_ITEMS}개)`}</Paragraph.Text>
      <Spacing size={12} />
      <Chip wrap>
        {INSTRUMENTS.map((inst) => (
          <ChipItem
            key={inst.symbol}
            data-testid={`instrument-chip-${inst.symbol}`}
            selected={items.some((it) => it.symbol === inst.symbol)}
            onClick={() => toggle(inst.symbol)}
          >
            {inst.name}
          </ChipItem>
        ))}
      </Chip>

      <Spacing size={20} />

      <Card testId="weight-sum-card">
        <Paragraph.Text typography="st11">담은 종목 비중</Paragraph.Text>
        <Spacing size={8} />
        {items.length === 0 ? (
          <Paragraph.Text typography="t6">종목을 먼저 담아주세요</Paragraph.Text>
        ) : (
          items.map((it) => {
            const inst = getInstrument(it.symbol);
            return (
              <div
                key={it.symbol}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0' }}
              >
                <Paragraph.Text typography="t6">{inst?.name ?? it.symbol}</Paragraph.Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 96 }}>
                  <TextField
                    variant="line"
                    inputMode="numeric"
                    enterKeyHint="done"
                    placeholder="0"
                    data-testid={`weight-input-${it.symbol}`}
                    value={String(it.weight)}
                    onChange={(e) => setWeight(it.symbol, e.target.value)}
                  />
                  <Paragraph.Text typography="t6">%</Paragraph.Text>
                </div>
              </div>
            );
          })
        )}
        <Spacing size={8} />
        <Paragraph.Text typography="st13" color={sum === 100 ? 'tertiary' : 'critical'}>
          {sum === 100 ? '비중 합계 100%' : `비중 합계를 100%로 맞춰주세요 (현재 ${sum}%)`}
        </Paragraph.Text>
      </Card>

      <Spacing size={20} />

      <Paragraph.Text typography="t4">기간</Paragraph.Text>
      <Spacing size={12} />
      <Chip kind="select">
        {YEAR_OPTIONS.map((y) => (
          <ChipItem
            key={y}
            data-testid={`year-chip-${y}`}
            selected={years === y}
            onClick={() => {
              fireHaptic('tickWeak');
              setYears(y);
            }}
          >
            {`${y}년`}
          </ChipItem>
        ))}
      </Chip>

      <Spacing size={24} />

      <Paragraph.Text typography="t4">저장한 포트폴리오</Paragraph.Text>
      <Spacing size={12} />
      {presets.length === 0 ? (
        <EmptyState
          title="저장한 포트폴리오가 없어요"
          description="종목을 담고 백테스트를 실행해 보세요"
        />
      ) : (
        presets
          .slice()
          .reverse()
          .map((p) => (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <Card>
                <ListRow
                  data-testid={`preset-row-${p.id}`}
                  onClick={() => runPreset(p)}
                  contents={
                    <ListRow.Texts
                      type="2RowTypeA"
                      top={p.name}
                      bottom={`${p.items.length}종목 · ${p.years}년`}
                    />
                  }
                  right={
                    <Button
                      variant="weak"
                      size="small"
                      data-testid={`preset-delete-${p.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePreset(p.id);
                      }}
                    >
                      삭제
                    </Button>
                  }
                />
              </Card>
            </div>
          ))
      )}

      <Spacing size={16} />
      <Paragraph.Text typography="st13" color="tertiary">
        본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.
      </Paragraph.Text>

      {/* 하단 고정 CTA 여백 */}
      <div style={{ height: 100 }} />

      <Toast
        open={!!toastMsg}
        position="bottom"
        text={toastMsg ?? ''}
        higherThanCTA
        onClose={() => setToastMsg(null)}
      />
    </ScreenScaffold>
  );
}
