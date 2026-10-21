'use client'

import { Badge, Button } from '@scent-jo/react'

/**
 * 앱바 우측의 필터 버튼 (`DESIGN.md` 「화면별 우측 액션」). `/study`와 `/review`가 같은 것을
 * 쓴다 — 배지 규격을 두 화면에 복제하면 한쪽만 고쳐도 화면이 멀쩡해 조용히 갈린다
 * (`.claude/rules/code-conventions.md` 「SSOT」).
 *
 * DS에 필터 아이콘이 없어 글자 버튼이다. **`lg`에서는 사라진다** — 패널이 사이드바로 이미 열려
 * 있다 (`DESIGN.md` 「화면 구성」 ④). 배지는 선택 상태라 정오 색(`green`·`red`)을 쓰지 않는다.
 */
export function FilterButton({
  badgeCount,
  onClick,
}: {
  /** 선택된 **값의 총 개수**다. 필터 종류 수가 아니다 (`activeFilterCount`). */
  badgeCount: number
  onClick: () => void
}) {
  return (
    <Button
      color="dark"
      variant="weak"
      size="small"
      aria-label={badgeCount > 0 ? `필터 ${badgeCount}개 적용` : undefined}
      onClick={onClick}
      className="lg:hidden"
    >
      필터
      {badgeCount > 0 && (
        <Badge color="blue" variant="fill" size="xsmall" className="ml-1">
          {badgeCount}
        </Badge>
      )}
    </Button>
  )
}
