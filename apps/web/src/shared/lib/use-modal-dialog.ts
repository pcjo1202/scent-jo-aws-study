'use client'

import { useEffect, useRef } from 'react'

/**
 * 네이티브 `dialog`를 `isOpen`에 맞춘다. `showModal()`이 포커스 트랩·`Esc` 닫기·배경
 * 비활성화를 대신하므로 그것들을 직접 구현하지 않는다.
 *
 * 닫기는 `onClose`로만 알린다 — `Esc`와 버튼이 같은 경로를 지나야 호출부의 상태가 갈리지 않는다.
 */
export function useModalDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return dialogRef
}
