'use client'

import { useEffect, useId, useRef } from 'react'

import { QUESTION_SHORTCUT_HELP } from '@/shared/lib/use-question-shortcuts'
import { Button } from '@/shared/ui/button'

/**
 * `?`가 여는 단축키 도움말. 네이티브 `dialog`의 `showModal()`을 쓰므로 포커스 트랩·`Esc`
 * 닫기·배경 비활성화를 직접 구현하지 않는다.
 *
 * 목록은 `QUESTION_SHORTCUT_HELP` 하나에서 온다 — 실제로 동작하는 단축키와 도움말이
 * 갈리면 도움말이 거짓말을 한다.
 */
export function ShortcutHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="rounded-corner-extra-large bg-surface-container-high p-6 text-on-surface"
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
