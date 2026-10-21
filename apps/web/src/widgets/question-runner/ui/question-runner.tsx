'use client'

import type { AttemptResponse, ChoiceKey, Question } from '@aws-study/shared'

import { ChoiceList } from '@/shared/ui/choice/choice-list'
import { GradedChoiceList } from '@/shared/ui/choice/graded-choice-list'
import { ExplanationBlock } from '@/shared/ui/explanation/explanation-block'
import { ResultBanner } from '@/shared/ui/result-banner'

/**
 * `wrap-break-word`는 상속되므로 여기 한 곳이 지문·선택지·해설을 다 덮는다. DS 기본
 * `word-break: keep-all`은 띄어쓰기 없는 긴 덩어리(ARN·정책 키·붙여 쓴 서비스명)를 끊지 못해
 * 375px에서 카드 밖으로 넘친다 — 1019문항의 지문·선택지·해설에서 공백 없이 26자 이상인 덩어리
 * 43개를 각자의 칸에 넣어 쟀더니 11개가 칸을 넘쳤다 (2026-10-21, SJO-64).
 */
const RUNNER_CLASS = 'flex flex-col gap-6 wrap-break-word'

/**
 * 문항 하나를 그린다. `/study`·`/review`·`/exam/[id]`가 같은 부품을 쓰고 **모드에 따라 채점
 * 시점만 다르다** (`docs/02-features.md` 「공통: 문제 풀이 컴포넌트」).
 *
 * 상태를 갖지 않는다 — 선택값도 채점 결과도 화면이 소유해야 되돌아가기가 `[대기]`로 열린다
 * (`docs/02-features.md` 「`/study` 순차 풀이」).
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
  const stem = <p className="whitespace-pre-wrap text-t5">{question.stem}</p>

  if (!graded) {
    return (
      <div className={RUNNER_CLASS}>
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
    <div className={RUNNER_CLASS}>
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
