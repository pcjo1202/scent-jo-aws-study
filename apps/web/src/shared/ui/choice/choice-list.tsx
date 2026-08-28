'use client'

import { useId } from 'react'

import type { ChoiceKey } from '@aws-study/shared'

import { isChoiceDisabled, isSingleAnswer } from '@/shared/lib/choice-selection'
import { ChoiceItem } from '@/shared/ui/choice/choice-item'

/**
 * 선택지 목록. 상태를 갖지 않는다 — 선택값과 갱신을 화면이 소유해야 `/study`·`/review`·
 * `/exam`이 채점 시점만 달리해서 같은 부품을 쓴다 (`docs/02-features.md` 「모드별 차이」).
 *
 * 복수정답이면 필요 개수를 명시한다. 실제 시험도 `Choose TWO`로 알려주므로 숨기는 것이
 * 시험 환경과 다르다 (`DESIGN.md` 「단일정답 / 복수정답」).
 */
export function ChoiceList({
  choices,
  selected,
  answerCount,
  onToggle,
}: {
  choices: Array<{ key: ChoiceKey; text: string }>
  selected: ChoiceKey[]
  answerCount: number
  onToggle: (key: ChoiceKey) => void
}) {
  // 라디오는 같은 name으로 묶여야 서로를 밀어낸다. 한 화면에 문제가 둘 이상 뜰 수 있으므로
  // 고정 문자열을 쓰지 않는다.
  const groupName = useId()
  const hasSingleAnswer = isSingleAnswer(answerCount)

  return (
    <fieldset>
      <legend
        className={hasSingleAnswer ? 'sr-only' : 'mb-2 text-body-medium text-on-surface-variant'}
      >
        {hasSingleAnswer ? '선택지' : `정답 ${answerCount}개를 고르세요`}
      </legend>

      <div className="flex flex-col gap-2">
        {choices.map((choice, index) => (
          <ChoiceItem
            key={choice.key}
            choiceKey={choice.key}
            text={choice.text}
            order={index + 1}
            groupName={groupName}
            answerCount={answerCount}
            isSelected={selected.includes(choice.key)}
            isDisabled={isChoiceDisabled(selected, choice.key, { answerCount })}
            onToggle={onToggle}
          />
        ))}
      </div>
    </fieldset>
  )
}
