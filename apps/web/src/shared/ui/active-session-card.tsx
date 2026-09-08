import type { ReactNode } from 'react'

import { formatSessionDate } from '@/shared/lib/format-session-date'

/**
 * 「진행 중 모의고사 이어풀기」 규격 (`DESIGN.md` 「대시보드 요소」). 대시보드와 `/exam` 목록이
 * 같은 규격을 쓰고 **다른 것은 액션뿐**이다 — 목록에는 「포기」가 있고 대시보드에는 그 경로가
 * 없다 (`docs/02` 「목록 화면」).
 *
 * **상태 배너가 아니다.** 그쪽은 로딩·오류·저장 대기 셋 전용인데 면·shape·타입스케일·최소
 * 높이가 같아서 `/exam` 목록에서는 실제로 나란히 선다. 가르는 것은 `outline` 1px 하나다
 * (2026-09-08 실화면 리뷰, SJO-23).
 *
 * 진행 위치(`12 / 65`)를 적지 않는 이유는 `GET /exams`가 `cursor`를 담지 않기 때문이다
 * (`docs/05`). 없는 값을 화면이 지어내지 않는다.
 */
export function ActiveSessionCard({
  startedAt,
  children,
}: {
  startedAt: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-corner-medium border border-outline bg-surface-container px-4 py-2 text-body-medium">
      <span className="flex-1">진행 중인 모의고사 · {formatSessionDate(startedAt)} 시작</span>
      {children}
    </div>
  )
}
