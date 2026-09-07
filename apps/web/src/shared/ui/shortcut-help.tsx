'use client'

import { useId } from 'react'

import { useModalDialog } from '@/shared/lib/use-modal-dialog'
import { QUESTION_SHORTCUT_HELP } from '@/shared/lib/use-question-shortcuts'
import { Button } from '@/shared/ui/button'

/**
 * `?`가 여는 단축키 도움말. `DESIGN.md` 「다이얼로그」가 명시한 **예외 하나**다 — 확인이
 * 아니라 읽는 것이지만 그릇이 같아 `.dialog`(폭·scrim)와 `useModalDialog`을 함께 쓴다.
 *
 * 목록은 `QUESTION_SHORTCUT_HELP` 하나에서 온다 — 실제로 동작하는 단축키와 도움말이
 * 갈리면 도움말이 거짓말을 한다.
 */
export function ShortcutHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useModalDialog(isOpen)
  const titleId = useId()

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="dialog rounded-corner-extra-large bg-surface-container-high p-6 text-on-surface"
    >
      <h2 id={titleId}>단축키</h2>
      <dl className="mt-4 flex flex-col gap-2 text-body-medium">
        {QUESTION_SHORTCUT_HELP.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-baseline justify-between gap-6">
            <dt className="text-on-surface-variant">{shortcut.keys}</dt>
            <dd>{shortcut.description}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>닫기</Button>
      </div>
    </dialog>
  )
}
