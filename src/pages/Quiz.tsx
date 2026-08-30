import { useState } from 'react';
import { Top, ListRow, Paragraph, Spacing } from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { Card } from '../components/Card';
import { MiniBar } from '../components/MiniBar';
import { ButtonStack } from '../components/BottomCTA';
import { QUIZ_QUESTIONS, scoreQuiz, recommendedSymbols, saveQuizRecord } from '../lib/quiz';

export default function Quiz() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(QUIZ_QUESTIONS.length).fill(null));
  const [error, setError] = useState<string | null>(null);

  const question = QUIZ_QUESTIONS[index];
  const isLast = index === QUIZ_QUESTIONS.length - 1;
  const picked = answers[index];

  const choose = (choiceIdx: number) => {
    setError(null);
    setAnswers((prev) => prev.map((a, i) => (i === index ? choiceIdx : a)));
  };

  const goNext = () => {
    if (picked === null) {
      setError('답변을 선택해 주세요');
      return;
    }
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    const finalAnswers = answers.map((a) => a ?? 0);
    const { score, type } = scoreQuiz(finalAnswers);
    const symbols = recommendedSymbols(type);
    saveQuizRecord({
      answers: finalAnswers.map((a) => a + 1),
      score,
      type,
      recommendedSymbols: symbols,
      answeredAt: new Date().toISOString(),
    });
    navigate('/quiz/result', { state: { score, type } });
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
          primary={{ label: isLast ? '결과 보기' : '다음 문항', onClick: goNext, disabled: picked === null }}
          secondary={{ label: index === 0 ? '홈으로' : '이전 문항', onClick: goPrev }}
        />
      }
    >
      <Paragraph.Text typography="st11">{`${index + 1} / ${QUIZ_QUESTIONS.length}`}</Paragraph.Text>
      <Spacing size={8} />
      <MiniBar ratio={(index + 1) / QUIZ_QUESTIONS.length} testId="quiz-progress" />

      <Spacing size={20} />

      <Paragraph.Text typography="t3">{question.text}</Paragraph.Text>

      <Spacing size={16} />

      <Card testId="quiz-options">
        {question.choices.map((choice, i) => (
          <ListRow
            key={choice.label}
            onClick={() => choose(i)}
            contents={<ListRow.Texts type="2RowTypeA" top={choice.label} bottom={picked === i ? '선택함' : ''} />}
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
