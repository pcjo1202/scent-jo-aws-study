'use client'

import { breakpoint } from '@scent-jo/css'
import { BottomSheet } from '@scent-jo/react'
import { useEffect, type ReactNode } from 'react'

/** 이 폭부터는 패널이 AppShell 사이드바다 (`DESIGN.md` 「화면 구성」 ③). */
const SIDEBAR_QUERY = `(width >= ${breakpoint.lg}px)`

/**
 * 화면 보조 패널의 **`lg` 미만 그릇** — DS `BottomSheet`다 (`DESIGN.md` 「화면 보조 패널」).
 * `lg` 이상의 그릇은 AppShell 사이드바이고 내용은 같다. `/study`·`/review`의 필터와
 * `/exam/[id]`의 문제 이동 그리드가 이것을 나눠 쓴다.
 *
 * **시트는 `showModal()`로 뜬 `dialog`다(DS).** `useQuestionShortcuts`가 모달 여부를
 * `closest('dialog[open]')` 하나로 판정하므로, 시트 안 컨트롤에 포커스가 있을 때 `←`·`→`가
 * 뒤 문항의 커서를 옮기지 않는다.
 *
 * **`lg`로 넓어지면 닫는다.** 모달은 top layer에 올라가 폭이 바뀌어도 모달인 채로 남는다 —
 * 사이드바가 이미 같은 내용을 보여 주는데 그 위에 시트가 덮인 채로 선다.
 */
export function PanelSheet({
  label,
  isOpen,
  onClose,
  cta,
  children,
}: {
  label: string
  isOpen: boolean
  onClose: () => void
  /** 보통 `BottomSheet.CTA`. 필터의 「N문제 보기」가 그렇다. */
  cta?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!isOpen) return

    const sidebar = window.matchMedia(SIDEBAR_QUERY)
    if (sidebar.matches) {
      onClose()
      return
    }

    function handleChange(event: MediaQueryListEvent) {
      if (event.matches) onClose()
    }

    sidebar.addEventListener('change', handleChange)
    return () => sidebar.removeEventListener('change', handleChange)
  }, [isOpen, onClose])

  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      aria-label={label}
      header={<BottomSheet.Header>{label}</BottomSheet.Header>}
      cta={cta}
    >
      <div className="flex flex-col gap-6 px-6 pb-6">{children}</div>
    </BottomSheet>
  )
}
