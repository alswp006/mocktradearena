import { useEffect, useMemo, useState } from 'react';
import { Top, ListRow, Button, Paragraph, Spacing, Chip, Badge, AlertDialog, BottomSheet, Toast } from '@toss/tds-mobile';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { Sparkline } from '../components/Sparkline';
import { EmptyState } from '../components/StateView';
import { DisclaimerNotice } from '../components/DisclaimerNotice';
import { AdSection } from '../components/AdSection';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { useAppState } from '../store/AppStateContext';
import { formatNumber } from '../lib/utils';
import { getClose } from '../lib/priceEngine';
import { todayKst, addDaysKST } from '../lib/date';

const MENUS = [
  { key: 'market', title: '모의매매', description: '가상자금으로 사고팔기', path: '/market' },
  { key: 'backtest', title: '백테스트', description: '과거 데이터로 수익률 확인', path: '/backtest' },
  { key: 'quiz', title: '투자성향 진단', description: '8문항으로 성향 확인', path: '/quiz' },
  { key: 'leaderboard', title: '랭킹', description: '평가자산 순위 보기', path: '/leaderboard' },
];

const TREND_DAYS = 30;

function haptic(type: 'success' | 'tickWeak') {
  try {
    Promise.resolve(generateHapticFeedback({ type })).catch(() => {});
  } catch {
    /* WebView 밖에서는 throw — 무시 */
  }
}

export default function Home() {
  const navigate = useNavigate();
  const { account, positions, streak, meta, checkInResult, setDisclaimerSeen, totalAsset } =
    useAppState();

  const [grantToastOpen, setGrantToastOpen] = useState(false);
  const [bonusSheetOpen, setBonusSheetOpen] = useState(false);

  useEffect(() => {
    if (checkInResult?.granted) {
      setGrantToastOpen(true);
      haptic('success');
      if (checkInResult.bonusAmount > 0) {
        setBonusSheetOpen(true);
      }
    }
  }, [checkInResult]);

  const heldSymbols = Object.keys(positions);
  const hasPositions = heldSymbols.length > 0;

  const invested = useMemo(
    () => heldSymbols.reduce((sum, s) => sum + positions[s].qty * positions[s].avgPrice, 0),
    [positions, heldSymbols],
  );
  const holdingsValue = totalAsset - account.cash;
  const pnl = holdingsValue - invested;

  const returnPct = useMemo(() => {
    if (account.totalGranted <= 0) return 0;
    return Math.round(((totalAsset - account.totalGranted) / account.totalGranted) * 1000) / 10;
  }, [totalAsset, account.totalGranted]);

  const trendData = useMemo(() => {
    const today = todayKst();
    const points: number[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const date = addDaysKST(today, -i);
      const holdings = heldSymbols.reduce((sum, s) => sum + positions[s].qty * getClose(s, date), 0);
      points.push(account.cash + holdings);
    }
    return points;
  }, [heldSymbols, positions, account.cash]);

  function goTo(path: string) {
    haptic('tickWeak');
    navigate(path);
  }

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>MockTradeArena</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={MAIN_TAB_ITEMS} />}
    >
      <SummaryHero
        testId="home-asset-hero"
        label="총 평가자산"
        value={<Amount value={totalAsset} unit="원" typography="t2" />}
        caption={
          <Badge size="small" variant="weak" color={returnPct >= 0 ? 'red' : 'blue'}>
            {returnPct >= 0 ? `+${returnPct}%` : `${returnPct}%`}
          </Badge>
        }
      />

      <Spacing size={16} />

      <Sparkline testId="home-trend-sparkline" data={trendData} />

      <Spacing size={24} />

      <Paragraph.Text typography="t4">연속 출석</Paragraph.Text>
      <Spacing size={12} />
      <Card testId="home-streak-card">
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={`${streak.currentStreak}일 연속 출석 중이에요`}
              bottom={`누적 보너스 ${formatNumber(streak.totalBonus)}원`}
            />
          }
          right={<Chip>{`${streak.currentStreak}일`}</Chip>}
        />
      </Card>

      <Spacing size={24} />

      <Paragraph.Text typography="t4">보유 종목</Paragraph.Text>
      <Spacing size={12} />
      {hasPositions ? (
        <Card testId="home-holdings-card">
          <ListRow
            onClick={() => goTo('/portfolio')}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={`${heldSymbols.length}개 종목 보유 중`}
                bottom={`평가손익 ${pnl >= 0 ? '+' : ''}${formatNumber(pnl)}원`}
              />
            }
          />
        </Card>
      ) : (
        <EmptyState
          testId="home-holdings-empty"
          title="아직 보유 종목이 없어요"
          description="가상자금으로 첫 매매를 시작해 보세요"
          action={
            <Button variant="weak" display="block" onClick={() => goTo('/market')}>
              모의매매 시작하기
            </Button>
          }
        />
      )}

      <Spacing size={24} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MENUS.map((menu) => (
          <Card key={menu.key} testId="home-menu-card">
            <ListRow
              onClick={() => goTo(menu.path)}
              contents={
                <ListRow.Texts type="2RowTypeA" top={menu.title} bottom={menu.description} />
              }
            />
          </Card>
        ))}
      </div>

      <AdSection />

      <DisclaimerNotice />

      {/* 하단 고정 탭바 여백 */}
      <div style={{ height: 88 }} />

      <AlertDialog
        open={!meta.disclaimerSeen}
        title="모의투자 안내"
        description="본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다."
        alertButton={<AlertDialog.AlertButton onClick={setDisclaimerSeen}>확인</AlertDialog.AlertButton>}
        onClose={setDisclaimerSeen}
      />

      <BottomSheet open={bonusSheetOpen} onClose={() => setBonusSheetOpen(false)}>
        <div style={{ padding: 16 }}>
          <Paragraph.Text typography="t3">
            {`${checkInResult?.streakDays ?? streak.currentStreak}일 연속 출석! 보너스 ${formatNumber(
              checkInResult?.bonusAmount ?? 0,
            )}원`}
          </Paragraph.Text>
        </div>
      </BottomSheet>

      <Toast
        open={grantToastOpen}
        position="bottom"
        text="오늘의 가상자금 1,000,000원이 지급됐어요"
        onClose={() => setGrantToastOpen(false)}
      />
    </ScreenScaffold>
  );
}
