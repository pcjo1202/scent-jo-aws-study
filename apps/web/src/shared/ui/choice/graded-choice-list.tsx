import type { ChoiceKey } from '@aws-study/shared'

import { toChoiceResult } from '@/shared/lib/choice-result'
import { GradedChoiceItem } from '@/shared/ui/choice/graded-choice-item'

/**
 * 채점 후 선택지 목록. `ChoiceList`와 별개인 이유는 조작이 사라지기 때문이다 — 여기엔
 * 라디오 그룹도, 필요 개수 안내도, 비활성 판정도 없다.
 *
 * `answer`는 서버가 준 정답이다 (`docs/05-database.md`). 화면이 다시 채점하지 않는다.
 */
export function GradedChoiceList({
  choices,
  selected,
  answer,
}: {
  choices: Array<{ key: ChoiceKey; text: string }>
  selected: ChoiceKey[]
  answer: ChoiceKey[]
}) {
  return (
    <ul className="flex flex-col gap-2">
      {choices.map((choice) => (
        <li key={choice.key}>
          <GradedChoiceItem
            choiceKey={choice.key}
            text={choice.text}
            result={toChoiceResult(choice.key, { selected, answer })}
          />
        </li>
      ))}
    </ul>
  )
}
