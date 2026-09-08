'use client'

import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

/**
 * 앱바 우측의 필터 버튼 (`DESIGN.md` 「화면별 우측 액션」). `/study`와 `/review`가 같은 것을
 * 쓴다 — 배지 규격을 두 화면에 복제하면 한쪽만 고쳐도 화면이 멀쩡해 조용히 갈린다
 * (`.claude/rules/code-conventions.md` 「SSOT」).
 *
 * **`expanded`에서는 사라진다** — 패널이 이미 열려 있다. 규칙 하나가 두 화면을 덮는다.
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
    <button
      type="button"
      aria-label={badgeCount > 0 ? `필터 ${badgeCount}개 적용` : '필터'}
      onClick={onClick}
      className="state-layer relative flex size-12 items-center justify-center rounded-corner-full expanded:hidden"
    >
      <MaterialSymbol name="filter_list" />
      {badgeCount > 0 && (
        <span className="absolute right-1 top-1 min-w-4 rounded-corner-full bg-secondary-container px-1 text-center text-label-medium text-on-secondary-container">
          {badgeCount}
        </span>
      )}
    </button>
  )
}
