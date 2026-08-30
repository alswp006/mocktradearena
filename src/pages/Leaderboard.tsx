import { useMemo } from 'react';
import { Top, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { MAIN_TAB_ITEMS } from '../lib/navigation';
import { useAppState } from '../store/AppStateContext';
import { loadLeaderboardSeed } from '../lib/storage';
import { formatNumber } from '../lib/utils';

const ME_ID = 'me';

export default function Leaderboard() {
  const { totalAsset } = useAppState();

  const ranked = useMemo(() => {
    const seed = loadLeaderboardSeed().map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      score: entry.score,
      isMe: false,
    }));
    // 로그인 미연동 환경에서도 에러 없이 "나"로 표기한다(spec F8-AC6).
    const rows = [...seed, { userId: ME_ID, userName: '나', score: totalAsset, isMe: true }];
    rows.sort((a, b) => b.score - a.score || a.userName.localeCompare(b.userName));
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  }, [totalAsset]);

  const myRank = ranked.find((row) => row.isMe)?.rank ?? ranked.length;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>랭킹</Top.TitleParagraph>} />}
      bottom={<FloatingTabBar items={MAIN_TAB_ITEMS} />}
    >
      <SummaryHero
        label="내 순위"
        value={<Paragraph.Text typography="t2">{`${myRank}위`}</Paragraph.Text>}
        caption={`총 ${ranked.length}명 중 · 평가자산 ${formatNumber(totalAsset)}원`}
        testId="rank-hero"
      />

      <Spacing size={16} />

      <Card testId="leaderboard-list">
        {ranked.slice(0, 50).map((row) => (
          <ListRow
            key={row.userId}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={`${row.rank}위 · ${row.userName}`}
                bottom={`${formatNumber(row.score)}원`}
              />
            }
          />
        ))}
      </Card>

      {/* 하단 고정 탭바 여백 */}
      <div style={{ height: 88 }} />
    </ScreenScaffold>
  );
}
