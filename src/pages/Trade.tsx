import { useMemo, useState } from 'react';
import { Top, Tab, TextField, ListRow, Paragraph, Spacing, Toast } from '@toss/tds-mobile';
import { useNavigate, useParams } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { Amount } from '../components/Amount';
import { EmptyState } from '../components/StateView';
import { ButtonStack } from '../components/BottomCTA';
import { useAppState } from '../store/AppStateContext';
import { getInstrument } from '../data/instruments';
import { getClose } from '../lib/priceEngine';
import { todayKst } from '../lib/date';
import { formatNumber } from '../lib/utils';

const BUY_FEE_RATE = 0.00015;
const SELL_TAX_RATE = 0.0018;

export default function Trade() {
  const navigate = useNavigate();
  const { symbol = '' } = useParams();
  const { account, positions, buy, sell } = useAppState();

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qtyText, setQtyText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const instrument = getInstrument(symbol);
  const price = useMemo(() => {
    if (!instrument) return 0;
    try {
      return getClose(symbol, todayKst());
    } catch {
      return 0;
    }
  }, [instrument, symbol]);

  const held = positions[symbol]?.qty ?? 0;
  const qty = Number(qtyText.replace(/[^0-9]/g, '')) || 0;
  const amount = qty * price;
  const fee =
    side === 'BUY'
      ? Math.floor(amount * BUY_FEE_RATE)
      : Math.floor(amount * BUY_FEE_RATE) + Math.floor(amount * SELL_TAX_RATE);
  const settle = side === 'BUY' ? amount + fee : amount - fee;

  if (!instrument) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>주문</Top.TitleParagraph>} />}>
        <EmptyState
          title="종목 정보를 찾지 못했어요"
          description="마켓에서 종목을 다시 골라 주세요"
          testId="trade-unknown"
        />
        <ButtonStack primary={{ label: '마켓으로 돌아가기', onClick: () => navigate('/market') }} />
      </ScreenScaffold>
    );
  }

  const handleSubmit = () => {
    if (qty < 1) {
      setError('수량을 1주 이상 입력해주세요');
      return;
    }
    setSubmitting(true);
    const result = side === 'BUY' ? buy(symbol, qty) : sell(symbol, qty);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? '주문을 체결하지 못했어요');
      return;
    }
    setError(null);
    setToast(`${instrument.name} ${qty}주 ${side === 'BUY' ? '매수' : '매도'} 체결`);
    navigate('/portfolio', { state: { justTradedSymbol: symbol } });
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>{instrument.name}</Top.TitleParagraph>} />}
      bottom={
        <ButtonStack
          primary={{
            label: submitting ? '체결 중' : side === 'BUY' ? '매수하기' : '매도하기',
            onClick: handleSubmit,
            disabled: submitting,
          }}
          secondary={{ label: '마켓으로 돌아가기', onClick: () => navigate('/market') }}
        />
      }
    >
      <Card testId="trade-price-card">
        <Paragraph.Text typography="st11">현재가</Paragraph.Text>
        <Spacing size={4} />
        <Amount value={price} unit="원" typography="t2" />
        <Spacing size={8} />
        <Paragraph.Text typography="t6">{`${instrument.symbol} · 보유 ${held}주`}</Paragraph.Text>
      </Card>

      <Spacing size={16} />

      <Tab
        onChange={(index: number) => {
          setSide(index === 0 ? 'BUY' : 'SELL');
          setError(null);
        }}
      >
        <Tab.Item selected={side === 'BUY'}>매수</Tab.Item>
        <Tab.Item selected={side === 'SELL'}>매도</Tab.Item>
      </Tab>

      <Spacing size={16} />

      <TextField
        variant="box"
        label="수량"
        placeholder="10"
        value={qtyText}
        inputMode="numeric"
        enterKeyHint="done"
        hasError={error !== null}
        help={error ?? undefined}
        onChange={(e) => {
          setQtyText(e.target.value);
          setError(null);
        }}
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
            <ListRow.Texts type="2RowTypeA" top="수수료" bottom={`${formatNumber(fee)}원`} />
          }
        />
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={side === 'BUY' ? '주문 후 잔액' : '입금 예정액'}
              bottom={`${formatNumber(side === 'BUY' ? account.cash - settle : account.cash + settle)}원`}
            />
          }
        />
      </Card>

      {/* 하단 고정 버튼에 가리지 않도록 여백 */}
      <div style={{ height: 132 }} />

      <Toast open={toast !== null} text={toast ?? ''} position="bottom" onClose={() => setToast(null)} />
    </ScreenScaffold>
  );
}
