import { useMemo, useState } from 'react';
import { Top, Tab, TextField, ListRow, Paragraph, Spacing, Toast, Badge } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';
import { EmptyState } from '../components/StateView';
import { SubmitFooter } from '../components/BottomCTA';
import { useAppState } from '../store/AppStateContext';
import { getInstrument } from '../data/instruments';
import { getClose, getDailySeries } from '../lib/priceEngine';
import { todayKst, addDaysKST } from '../lib/date';
import { formatNumber } from '../lib/utils';

const BUY_FEE_RATE = 0.00015;
const SELL_TAX_RATE = 0.0018;
const SPARKLINE_DAYS = 60;

function haptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖(브라우저/검수자 PC/jsdom)에서는 throw — 무시 */
  }
}

export default function Trade() {
  const navigate = useNavigate();
  const { symbol = '' } = useParams();
  const { account, positions, buy, sell } = useAppState();

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qtyText, setQtyText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const instrument = getInstrument(symbol);
  const today = todayKst();

  const price = useMemo(() => {
    if (!instrument) return 0;
    try {
      return getClose(symbol, today);
    } catch {
      return 0;
    }
  }, [instrument, symbol, today]);

  const prevClose = useMemo(() => {
    if (!instrument) return 0;
    try {
      return getClose(symbol, addDaysKST(today, -1));
    } catch {
      return 0;
    }
  }, [instrument, symbol, today]);

  const trend = useMemo(() => {
    if (!instrument) return [];
    try {
      return getDailySeries(symbol)
        .slice(-SPARKLINE_DAYS)
        .map((p) => p.close);
    } catch {
      return [];
    }
  }, [instrument, symbol]);

  if (!instrument) {
    return (
      <ScreenScaffold
        top={<Top title={<Top.TitleParagraph>주문</Top.TitleParagraph>} />}
        bottom={<SubmitFooter label="마켓으로 돌아가기" onClick={() => navigate('/market')} />}
      >
        <EmptyState
          title="종목을 찾을 수 없어요"
          description="마켓에서 종목을 다시 골라주세요"
          testId="trade-unknown"
        />
      </ScreenScaffold>
    );
  }

  const held = positions[symbol]?.qty ?? 0;
  const qty = Number(qtyText.replace(/[^0-9]/g, '')) || 0;
  const amount = qty * price;
  const fee =
    side === 'BUY'
      ? Math.floor(amount * BUY_FEE_RATE)
      : Math.floor(amount * BUY_FEE_RATE) + Math.floor(amount * SELL_TAX_RATE);
  const afterCash = side === 'BUY' ? account.cash - amount - fee : account.cash + amount - fee;
  const noHolding = side === 'SELL' && held === 0;
  const changePct = prevClose === 0 ? 0 : ((price - prevClose) / prevClose) * 100;

  let error: string | null = null;
  if (noHolding) {
    error = '보유 중인 수량이 없어요';
  } else if (qty >= 1) {
    if (side === 'BUY' && amount + fee > account.cash) {
      error = '잔액이 부족해요';
    } else if (side === 'SELL' && qty > held) {
      error = `보유 수량은 ${held}주예요`;
    }
  }

  const maxQty = side === 'BUY' ? Math.floor(account.cash / (price || 1)) : held;
  const canSubmit = !noHolding && qty >= 1 && error === null && !submitting;

  function handleTabChange(index: number) {
    haptic('tickWeak');
    setSide(index === 0 ? 'BUY' : 'SELL');
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const result = side === 'BUY' ? buy(symbol, qty) : sell(symbol, qty);
    setSubmitting(false);
    if (!result.ok) return;
    setToast(`${instrument!.name} ${qty}주 ${side === 'BUY' ? '매수' : '매도'} 체결`);
    navigate('/portfolio', { state: { justTradedSymbol: symbol } });
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{instrument.name}</Top.TitleParagraph>} />}
      bottom={
        <SubmitFooter
          label={side === 'BUY' ? '매수하기' : '매도하기'}
          onClick={handleSubmit}
          disabled={!canSubmit}
          testId="trade-submit-button"
        />
      }
    >
      <Card testId="trade-price-card">
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={`${formatNumber(price)}원`}
              bottom={`${symbol} · ${instrument.sector} · 보유 ${held}주`}
            />
          }
          right={
            <Badge size="small" variant="weak" color={changePct >= 0 ? 'red' : 'blue'}>
              {`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
            </Badge>
          }
        />
      </Card>

      <Spacing size={16} />
      <Sparkline data={trend} testId="trade-sparkline" />
      <Spacing size={24} />

      <Tab onChange={handleTabChange}>
        <Tab.Item selected={side === 'BUY'}>매수</Tab.Item>
        <Tab.Item selected={side === 'SELL'}>매도</Tab.Item>
      </Tab>

      <Spacing size={16} />

      <TextField
        variant="box"
        label="수량"
        placeholder="10"
        data-testid="trade-qty-input"
        value={qtyText}
        inputMode="numeric"
        enterKeyHint="done"
        disabled={noHolding}
        hasError={error !== null}
        help={error ?? `주문 가능 ${maxQty}주`}
        onChange={(e) => setQtyText(e.target.value)}
      />

      <Spacing size={16} />

      <Card testId="order-preview-card">
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="예상 체결금액"
              bottom={`${formatNumber(amount)}원`}
            />
          }
        />
        <ListRow
          contents={
            <ListRow.Texts type="2RowTypeA" top="수수료·세금" bottom={`${formatNumber(fee)}원`} />
          }
        />
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="거래 후 잔액"
              bottom={`${formatNumber(afterCash)}원`}
            />
          }
        />
      </Card>

      <Spacing size={16} />

      <Paragraph.Text typography="st13" color="tertiary">
        본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.
      </Paragraph.Text>

      {/* 하단 고정 CTA에 가리지 않도록 여백 */}
      <div style={{ height: 96 }} />

      <Toast open={toast !== null} text={toast ?? ''} position="bottom" onClose={() => setToast(null)} />
    </ScreenScaffold>
  );
}
