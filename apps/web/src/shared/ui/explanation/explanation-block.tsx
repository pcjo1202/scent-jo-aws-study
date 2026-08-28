import type { ChoiceKey } from '@aws-study/shared'

import { AnswerExplanation } from '@/shared/ui/explanation/answer-explanation'
import { RebuttalAccordion } from '@/shared/ui/explanation/rebuttal-accordion'
import { RequirementList } from '@/shared/ui/explanation/requirement-list'
import { ServiceChips } from '@/shared/ui/explanation/service-chips'

/**
 * 해설 블록. **순서를 고정한다. 임의로 바꾸지 않는다** (`DESIGN.md` 「해설 블록」) —
 * 요구사항 → 정답 해설 → 오답 해설 → 등장 서비스. 화면이 넷을 직접 조립하면 그 순서가
 * 화면마다 갈리므로 조립을 여기 한 곳에 둔다.
 */
export function ExplanationBlock({
  requirements,
  explanation,
  rebuttals,
  selected,
  services,
}: {
  requirements: string[]
  explanation: string
  rebuttals: Array<{ key: ChoiceKey; text: string }>
  selected: ChoiceKey[]
  services: Array<{ name: string; note: string }>
}) {
  return (
    <div className="flex flex-col gap-4">
      <RequirementList requirements={requirements} />
      <AnswerExplanation text={explanation} />
      <RebuttalAccordion rebuttals={rebuttals} selected={selected} />
      <ServiceChips services={services} />
    </div>
  )
}
