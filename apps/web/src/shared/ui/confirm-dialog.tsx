'use client'

import { useId } from 'react'

import { useModalDialog } from '@/shared/lib/use-modal-dialog'
import { Button } from '@/shared/ui/button'

/**
 * 되돌릴 수 없는 것을 확인받는다 — 진행 중 모의고사 포기, 세션 종료 (`DESIGN.md` 「다이얼로그」).
 *
 * **파기 버튼에 `error`를 쓰지 않는다.** 다이얼로그가 떠 있다는 것 자체가 이미 경고이고,
 * `error`는 채점 결과에 묶여 있다. 무게는 색이 아니라 문구가 나르므로 `confirmLabel`에
 * 「포기」·「종료」처럼 무엇이 일어나는지를 적는다 — 「확인」·「예」를 넘기지 않는다.
 *
 * `description`은 **무엇이 사라지는지**를 적는 자리다.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useModalDialog(isOpen)
  const titleId = useId()
  const descriptionId = useId()

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="dialog rounded-corner-extra-large bg-surface-container-high p-6 text-on-surface"
    >
      <h2 id={titleId} className="text-title-medium">
        {title}
      </h2>
      <p id={descriptionId} className="mt-4 text-body-medium text-on-surface-variant">
        {description}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={onCancel}>취소</Button>
        <Button variant="filled" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
