import type { ReactNode } from 'react'

import { formatSessionDate } from '@/shared/lib/format-session-date'

/**
 * 「진행 중 모의고사 이어풀기」 규격 (`DESIGN.md` 「대시보드 요소」). 대시보드와 `/exam` 목록이
 * 같은 규격을 쓰고 **다른 것은 액션뿐**이다 — 목록에는 「포기」가 있고 대시보드에는 그 경로가
 * 없다 (`docs/02` 「목록 화면」).
 *
 * **상태 배너가 아니다.** `/exam` 목록에서는 409 배너 바로 아래 이 카드가 서므로 둘이 갈려야
 * 한다 (2026-09-08 실화면 리뷰, SJO-23). 배너는 `bg-subtle` 면에 테두리가 없고, 이 카드는 기본
 * 면에 테두리를 둔다 — 같은 모서리·글자 크기여도 면과 선으로 갈린다.
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
    <div className="flex flex-wrap items-center gap-3 rounded-3 border border-default px-4 py-3 text-t6">
      {/* 날짜를 한 덩어리로 묶는다 — 액션이 둘인 `/exam`에서는 375px에서 `2026. 9.`와 `8.` 사이가 끊긴다. */}
      <span className="flex-1">
        진행 중인 모의고사 ·{' '}
        <span className="whitespace-nowrap">{formatSessionDate(startedAt)} 시작</span>
      </span>
      {children}
    </div>
  )
}
