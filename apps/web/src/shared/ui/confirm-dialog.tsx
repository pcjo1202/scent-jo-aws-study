'use client'

import { Button, Dialog } from '@scent-jo/react'

/**
 * 되돌릴 수 없는 것을 확인받는다 — 진행 중 모의고사 포기, 세션 종료 (`DESIGN.md` 「다이얼로그」).
 * DS `Dialog`(confirm)다. 액션은 취소 → 실행 순이다.
 *
 * **파기 버튼에 `danger`를 쓰지 않는다.** 다이얼로그가 떠 있다는 것 자체가 이미 경고이고,
 * `danger`는 채점 결과에 묶여 있다. 무게는 색이 아니라 문구가 나르므로 `confirmLabel`에
 * 「포기」·「종료」처럼 무엇이 일어나는지를 적는다 — 「확인」·「예」를 넘기지 않는다.
 *
 * `description`은 **무엇이 사라지는지**를 적는 자리다. `Esc`·딤도 취소와 같은 경로를 지난다.
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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={title}
      description={description}
      actions={
        <>
          <Button size="large" color="dark" variant="weak" onClick={onCancel}>
            취소
          </Button>
          <Button size="large" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
