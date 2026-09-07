import type { ChoiceKey } from '@aws-study/shared'

import { toChoiceResult } from '@/shared/lib/choice-result'
import { isSingleAnswer } from '@/shared/lib/choice-selection'
import { GradedChoiceItem } from '@/shared/ui/choice/graded-choice-item'
import { AnswerExplanation } from '@/shared/ui/explanation/answer-explanation'

/**
 * 채점 후 선택지 목록. `ChoiceList`와 별개인 이유는 조작이 사라지기 때문이다 — 여기엔
 * 라디오 그룹도, 비활성 판정도 없다. 남는 것은 **복수정답 안내**인데, 그것은 상태가 아니라
 * 문제의 성질이라 채점 후에도 남는다 (`docs/02-features.md` 「화면 구성 요소」).
 *
 * `answer`는 서버가 준 정답이다 (`docs/05-database.md`). 화면이 다시 채점하지 않는다.
 */
export function GradedChoiceList({
  choices,
  selected,
  answer,
  explanation,
  rebuttals,
}: {
  choices: Array<{ key: ChoiceKey; text: string }>
  selected: ChoiceKey[]
  answer: ChoiceKey[]
  explanation: string
  rebuttals: Array<{ key: ChoiceKey; text: string }>
}) {
  const rebuttalByKey = new Map(rebuttals.map((rebuttal) => [rebuttal.key, rebuttal.text]))

  // 정답 해설은 문항당 한 덩어리인데 정답 선택지는 2~3개일 수 있다 (123문항). 복제하면 같은
  // 본문이 화면에 두세 번 뜨므로 **첫 정답 카드에만** 넣는다 — 나머지 정답 카드는 펼칠 것이
  // 없어 정적 카드가 된다 (2026-09-07 결정, SJO-20).
  const answerExplanationKey = choices.find((choice) => answer.includes(choice.key))?.key

  return (
    <div>
      {!isSingleAnswer(answer.length) && (
        <p className="mb-2 text-body-medium text-on-surface-variant">
          정답 {answer.length}개를 고르세요
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {choices.map((choice) => {
          const rebuttal = rebuttalByKey.get(choice.key)
          const isChosen = selected.includes(choice.key)

          return (
            <li key={choice.key}>
              <GradedChoiceItem
                choiceKey={choice.key}
                text={choice.text}
                result={toChoiceResult(choice.key, { selected, answer })}
                explanation={
                  choice.key === answerExplanationKey ? (
                    <AnswerExplanation text={explanation} />
                  ) : (
                    // ③ 오답 해설. 제목을 달지 않는다 — 헤더는 선택지 카드 자체다
                    // (`DESIGN.md` 「③ 오답 해설」). 면색도 없다. 카드가 이미 면을 깔고 있다.
                    rebuttal && <p className="whitespace-pre-wrap text-body-medium">{rebuttal}</p>
                  )
                }
                // 내가 고른 오답과 정답만 기본 펼침이다. 오답 해설 넷이 한꺼번에 펼쳐지면
                // 화면이 두 배로 길어지고 정작 필요한 하나를 못 찾는다.
                isDefaultOpen={
                  choice.key === answerExplanationKey || (isChosen && Boolean(rebuttal))
                }
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
