import type { ReactNode } from 'react'

import { RequirementList } from '@/shared/ui/explanation/requirement-list'
import { ServiceChips } from '@/shared/ui/explanation/service-chips'

/**
 * 채점 후 본문의 순서를 소유한다 — ① 요구사항 → 선택지 → ④ 등장 서비스
 * (`DESIGN.md` 「해설 블록」). 화면이 셋을 직접 조립하면 그 순서가 화면마다 갈리므로
 * 조립을 여기 한 곳에 둔다.
 *
 * **②③이 여기 없는 것이 요점이다.** 정답 해설과 오답 해설은 선택지 카드 안으로 들어갔다 —
 * 오답 해설이 선택지를 문자로 참조하기 때문이다. ①과 ④는 특정 선택지에 속하지 않으므로
 * 밖에 남는다.
 */
export function ExplanationBlock({
  requirements,
  services,
  children,
}: {
  requirements: string[]
  services: Array<{ name: string; note: string | undefined }>
  /** 채점 후 선택지 목록 — `GradedChoiceList`. */
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <RequirementList requirements={requirements} />
      {children}
      <ServiceChips services={services} />
    </div>
  )
}
