import { Top, ListRow, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Amount } from '../components/Amount';
import { Card } from '../components/Card';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { useAppState } from '../store/AppStateContext';
import { formatNumber } from '../lib/utils';

const MENUS = [
  { key: 'market', title: '모의매매', description: '가상자금으로 사고팔기', path: '/market' },
  { key: 'backtest', title: '백테스트', description: '과거 데이터로 수익률 확인', path: '/backtest' },
  { key: 'quiz', title: '투자성향 진단', description: '8문항으로 성향 확인', path: '/quiz' },
  { key: 'leaderboard', title: '랭킹', description: '평가자산 순위 보기', path: '/leaderboard' },
];

export default function Home() {
  const navigate = useNavigate();
  const { account, positions, streak, checkInResult, totalAsset } = useAppState();

  const heldCount = Object.keys(positions).length;
  const grantedNow = checkInResult?.granted === true;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>MockTradeArena</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={MAIN_TAB_ITEMS} />}
    >
      <SummaryHero
        label="총 평가자산"
        value={<Amount value={totalAsset} unit="원" typography="t2" />}
        caption={`현금 ${formatNumber(account.cash)}원 · 보유 ${heldCount}종목`}
        action={
          <Button variant="fill" display="block" onClick={() => navigate('/market')}>
            모의매매 시작하기
          </Button>
        }
        testId="home-asset-hero"
      />

      <Spacing size={16} />

      <Card testId="home-streak-card">
        <ListRow
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top={`${streak.currentStreak}일 연속 출석 중`}
              bottom={
                grantedNow
                  ? `오늘 가상자금 ${formatNumber(checkInResult!.grantAmount + checkInResult!.bonusAmount)}원이 들어왔어요`
                  : `누적 보너스 ${formatNumber(streak.totalBonus)}원`
              }
            />
          }
        />
      </Card>

      <Spacing size={20} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MENUS.map((menu) => (
          <Card key={menu.key} testId="home-menu-card">
            <ListRow
              onClick={() => navigate(menu.path)}
              contents={
                <ListRow.Texts type="2RowTypeA" top={menu.title} bottom={menu.description} />
              }
            />
          </Card>
        ))}
      </div>

      <Spacing size={16} />

      <Paragraph.Text typography="st13">
        본 서비스는 가상자금 기반 모의투자이며, 실제 투자 성과를 보장하지 않습니다.
      </Paragraph.Text>

      {/* 하단 고정 탭바 여백 */}
      <div style={{ height: 88 }} />
    </ScreenScaffold>
  );
}
