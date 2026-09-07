'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { MaterialSymbol } from '@/shared/ui/icon/material-symbol'

/** `expanded` 상시 패널은 시트가 아니므로 `dialog`로 열지 않는다. 값은 `DESIGN.md` 「Layout」. */
const EXPANDED_BREAKPOINT = '(width >= 840px)'

/**
 * 화면 보조 패널의 **그릇** (`DESIGN.md` 「화면 보조 패널」). `compact`·`medium`에서는 전체 화면
 * 시트, `expanded`에서는 좌측 320px 상시 패널이고 **내용은 같다** — 그릇 전환은 `.side-panel`이
 * 맡는다 (`global.css`). `/study`·`/review`의 필터와 `/exam/[id]`의 문제 이동 그리드가 이것을
 * 나눠 쓴다.
 *
 * **시트는 네이티브 `dialog`의 `showModal()`로 연다.** 포커스 트랩·`Esc` 닫기·배경 비활성화를
 * 직접 구현하지 않으려는 것이 첫째이고, 둘째가 더 중요하다 — `useQuestionShortcuts`가 모달
 * 여부를 `closest('dialog[open]')` 하나로 판정하므로, 평범한 `div`로 두면 시트 안 컨트롤에
 * 포커스가 있을 때 `←`·`→`가 **뒤 문항의 커서를 옮긴다.**
 *
 * **폭 변화를 구독한다.** 모달로 연 `dialog`는 top-layer에 올라가 폭이 바뀌어도 모달인 채로
 * 남는다 — 시트로 열어 둔 상태에서 `expanded`로 넓히면 상시 패널 자리에 320px이 아니라 화면
 * 폭짜리 모달이 그대로 선다. 그릇이 바뀌면 닫는다.
 *
 * 헤더는 시트에만 있다 — 상시 패널에서는 그룹 제목이 이미 구조를 나른다. 헤더 우측
 * (`headerAction`)은 화면마다 다르다: 필터는 「모두 해제」, 그리드는 없다(해제할 것이 없다).
 */
export function SidePanel({
  label,
  isOpen,
  onClose,
  headerAction,
  children,
}: {
  label: string
  isOpen: boolean
  onClose: () => void
  headerAction?: ReactNode
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const expanded = window.matchMedia(EXPANDED_BREAKPOINT)

    function sync() {
      if (!dialog) return
      if (expanded.matches) {
        if (dialog.open) dialog.close()
        return
      }

      if (isOpen && !dialog.open) dialog.showModal()
      if (!isOpen && dialog.open) dialog.close()
    }

    sync()
    expanded.addEventListener('change', sync)
    return () => expanded.removeEventListener('change', sync)
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={label}
      className="side-panel bg-surface-container-low text-on-surface"
    >
      <div className="flex h-14 items-center gap-2 expanded:hidden">
        <button
          type="button"
          aria-label={`${label} 닫기`}
          onClick={onClose}
          className="state-layer flex size-12 shrink-0 items-center justify-center rounded-corner-full"
        >
          <MaterialSymbol name="arrow_back" />
        </button>
        <h2 className="flex-1 truncate text-label-large">{label}</h2>
        {headerAction}
      </div>

      <div className="flex flex-col gap-6 p-screen expanded:p-6">{children}</div>
    </dialog>
  )
}
