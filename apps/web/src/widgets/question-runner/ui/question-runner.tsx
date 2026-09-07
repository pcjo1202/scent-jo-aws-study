'use client'

import type { AttemptResponse, ChoiceKey, Question } from '@aws-study/shared'

import { isSingleAnswer } from '@/shared/lib/choice-selection'
import { ChoiceList } from '@/shared/ui/choice/choice-list'
import { GradedChoiceList } from '@/shared/ui/choice/graded-choice-list'
import { ExplanationBlock } from '@/shared/ui/explanation/explanation-block'
import { ResultBanner } from '@/shared/ui/result-banner'

/**
 * 문항 하나를 그린다. `/study`·`/review`·`/exam/[id]`가 같은 부품을 쓰고 **모드에 따라 채점
 * 시점만 다르다** (`docs/02-features.md` 「공통: 문제 풀이 컴포넌트」).
 *
 * 상태를 갖지 않는다 — 선택값도 채점 결과도 화면이 소유해야 되돌아가기가 `[대기]`로 열린다
 * (`docs/02-features.md` 「`/study` 순차 풀이」).
 *
 * 간격이 `graded`에 따라 다른 이유는 안내가 어느 상태에서든 **선택지에 8px로 붙기** 때문이다
 * (`DESIGN.md` 「간격」). 미채점에서는 안내가 지문↔선택지 24px 안으로 들어와 지문과 16px이
 * 되고, 채점 후에는 ① 요구사항이 그 자리를 차지해 지문↔① 가 언제나 24px이다.
 */
export function QuestionRunner({
  question,
  selected,
  onToggle,
  graded,
  notes,
}: {
  question: Question
  selected: ChoiceKey[]
  onToggle: (key: ChoiceKey) => void
  /** 서버가 준 채점 결과. `null`이면 아직 제출 전이다. */
  graded: AttemptResponse | null
  /** 서비스명 → 한줄노트. 없는 서비스가 7개 있다 (`ServiceChips`). */
  notes: Map<string, string>
}) {
  const stem = <p className="whitespace-pre-wrap text-body-large">{question.stem}</p>

  if (!graded) {
    const gap = isSingleAnswer(question.answer.length) ? 'gap-6' : 'gap-4'

    return (
      <div className={`flex flex-col ${gap}`}>
        {stem}
        <ChoiceList
          choices={question.choices}
          selected={selected}
          answerCount={question.answer.length}
          onToggle={onToggle}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ResultBanner isCorrect={graded.isCorrect} />
      {stem}
      <ExplanationBlock
        requirements={question.requirements}
        services={question.services.map((name) => ({ name, note: notes.get(name) }))}
      >
        <GradedChoiceList
          choices={question.choices}
          selected={selected}
          answer={graded.answer}
          explanation={question.explanation}
          rebuttals={question.rebuttals}
        />
      </ExplanationBlock>
    </div>
  )
}
