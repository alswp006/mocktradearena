import { useMemo } from 'react';
import { Top, ListRow, Button, Paragraph, Spacing } from '@toss/tds-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { SummaryHero } from '../components/SummaryHero';
import { Card } from '../components/Card';
import { EmptyState } from '../components/StateView';
import { ButtonStack } from '../components/BottomCTA';
import { loadQuiz } from '../lib/storage';
import { RECOMMENDED_SYMBOLS, RISK_DESCRIPTION, RISK_LABEL } from '../lib/quiz';
import { getInstrument } from '../data/instruments';
import type { RiskType } from '../lib/types';

type IncomingState = { score?: number; type?: RiskType } | null;

export default function QuizResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as IncomingState;

  // 라우터 state가 없으면(직접 진입·새로고침) 저장된 응시 결과로 복원한다.
  const resolved = useMemo(() => {
    if (state?.type) return { type: state.type, score: state.score ?? 0 };
    const stored = loadQuiz();
    return stored ? { type: stored.riskProfile, score: stored.score } : null;
  }, [state?.type, state?.score]);

  if (!resolved) {
    return (
      <ScreenScaffold top={<Top title={<Top.TitleParagraph>투자성향 결과</Top.TitleParagraph>} />}>
        <EmptyState
          title="아직 진단 기록이 없어요"
          description="8문항에 답하면 성향과 추천 종목을 볼 수 있어요"
          action={
            <Button variant="weak" display="block" onClick={() => navigate('/quiz')}>
              진단 시작하기
            </Button>
          }
          testId="quiz-result-empty"
        />
      </ScreenScaffold>
    );
  }

  const recommended = RECOMMENDED_SYMBOLS[resolved.type]
    .map((symbol) => getInstrument(symbol))
    .filter((it): it is NonNullable<typeof it> => it !== undefined);

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>투자성향 결과</Top.TitleParagraph>} />}
      bottom={
        <ButtonStack
          primary={{ label: '마켓에서 종목 보기', onClick: () => navigate('/market') }}
          secondary={{ label: '다시 진단하기', onClick: () => navigate('/quiz') }}
        />
      }
    >
      <SummaryHero
        label="내 투자성향"
        value={<Paragraph.Text typography="t2">{RISK_LABEL[resolved.type]}</Paragraph.Text>}
        caption={`${resolved.score}점 · ${RISK_DESCRIPTION[resolved.type]}`}
        testId="quiz-type-hero"
      />

      <Spacing size={20} />

      <Paragraph.Text typography="t4">성향에 맞는 종목</Paragraph.Text>
      <Spacing size={12} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recommended.map((it) => (
          <Card key={it.symbol} testId="recommend-card">
            <ListRow
              onClick={() => navigate(`/trade/${it.symbol}`, { state: { symbol: it.symbol, from: 'market' } })}
              contents={
                <ListRow.Texts type="2RowTypeA" top={it.name} bottom={`${it.symbol} · ${it.sector}`} />
              }
            />
          </Card>
        ))}
      </div>

      <Spacing size={16} />

      <Paragraph.Text typography="st13">
        성향 판정은 응답 점수 규칙으로만 계산해요. 투자 권유가 아닙니다.
      </Paragraph.Text>

      {/* 하단 고정 버튼 여백 */}
      <div style={{ height: 132 }} />
    </ScreenScaffold>
  );
}
