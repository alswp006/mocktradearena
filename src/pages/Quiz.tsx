import { useState } from 'react';
import { Top, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { MiniBar } from '../components/MiniBar';
import { ButtonStack } from '../components/BottomCTA';
import { saveQuiz } from '../lib/storage';
import { riskProfileOf } from '../lib/quiz';
import type { QuizResult } from '../lib/types';

type Question = { text: string; options: string[] };

// @AI:NOTE 선택지 순서 = 점수 1~4점(안정 → 공격). 합계 8~32점으로 성향을 판정한다.
const QUESTIONS: Question[] = [
  {
    text: '투자로 모은 돈을 언제 쓸 계획인가요?',
    options: ['1년 안에', '1~3년 사이', '3~7년 사이', '7년 뒤에도 괜찮아요'],
  },
  {
    text: '한 달 만에 원금이 20% 줄면 어떻게 하나요?',
    options: ['전부 판다', '일부 판다', '그대로 둔다', '더 산다'],
  },
  {
    text: '투자 경험은 어느 정도인가요?',
    options: ['예·적금만 해봤다', '펀드나 ETF까지', '개별 주식까지', '파생·해외까지'],
  },
  {
    text: '기대하는 연 수익률은 어느 정도인가요?',
    options: ['3% 안팎', '5% 안팎', '10% 안팎', '20% 이상'],
  },
  {
    text: '월 소득에서 투자에 넣는 비중은요?',
    options: ['10% 미만', '10~20%', '20~40%', '40% 이상'],
  },
  {
    text: '투자 손실이 생활에 주는 영향은요?',
    options: ['당장 곤란해진다', '조금 부담된다', '견딜 만하다', '거의 없다'],
  },
  {
    text: '종목을 고를 때 먼저 보는 건 무엇인가요?',
    options: ['원금 보전', '꾸준한 배당', '성장 가능성', '단기 급등 가능성'],
  },
  {
    text: '시장이 크게 흔들릴 때 계좌를 얼마나 자주 보나요?',
    options: ['불안해서 못 본다', '하루 한 번', '가끔 확인한다', '기회를 찾아본다'],
  },
];

export default function Quiz() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(QUESTIONS.length).fill(0));
  const [error, setError] = useState<string | null>(null);

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  const picked = answers[index];

  const choose = (value: number) => {
    setError(null);
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const goNext = () => {
    if (picked === 0) {
      setError('답변을 선택해 주세요');
      return;
    }
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    const score = answers.reduce((sum, a) => sum + a, 0);
    const riskProfile = riskProfileOf(score);
    const result: QuizResult = {
      id: `q-${Date.now().toString(36)}`,
      userId: 'me',
      answers,
      score,
      riskProfile,
      createdAt: new Date(),
    };
    saveQuiz(result);
    navigate('/quiz/result', { state: { score, type: riskProfile } });
  };

  const goPrev = () => {
    setError(null);
    if (index === 0) {
      navigate('/');
      return;
    }
    setIndex(index - 1);
  };

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>투자성향 진단</Top.TitleParagraph>} />}
      bottom={
        <ButtonStack
          primary={{ label: isLast ? '결과 보기' : '다음 문항', onClick: goNext, disabled: picked === 0 }}
          secondary={{ label: index === 0 ? '홈으로' : '이전 문항', onClick: goPrev }}
        />
      }
    >
      <Paragraph.Text typography="st11">{`${index + 1} / ${QUESTIONS.length}`}</Paragraph.Text>
      <Spacing size={8} />
      <MiniBar ratio={(index + 1) / QUESTIONS.length} testId="quiz-progress" />

      <Spacing size={20} />

      <Paragraph.Text typography="t3">{question.text}</Paragraph.Text>

      <Spacing size={16} />

      <Card testId="quiz-options">
        {question.options.map((option, i) => (
          <ListRow
            key={option}
            onClick={() => choose(i + 1)}
            contents={<ListRow.Texts type="2RowTypeA" top={option} bottom={picked === i + 1 ? '선택함' : ''} />}
          />
        ))}
      </Card>

      {error ? (
        <>
          <Spacing size={12} />
          <Paragraph.Text typography="st13">{error}</Paragraph.Text>
        </>
      ) : null}

      {/* 하단 고정 버튼 여백 */}
      <div style={{ height: 132 }} />
    </ScreenScaffold>
  );
}
