'use client'

import { Dialog, DialogAlertButton } from '@scent-jo/react'

import { QUESTION_SHORTCUT_HELP } from '@/shared/lib/use-question-shortcuts'

/**
 * `?`가 여는 단축키 도움말. `DESIGN.md` 「다이얼로그」가 명시한 **예외 하나**다 — 확인이
 * 아니라 읽는 것이지만 그릇이 같아 DS `Dialog`(alert)를 쓰고, 액션은 닫기 하나다.
 *
 * 목록은 `QUESTION_SHORTCUT_HELP` 하나에서 온다 — 실제로 동작하는 단축키와 도움말이
 * 갈리면 도움말이 거짓말을 한다.
 */
export function ShortcutHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog
      variant="alert"
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="단축키"
      actions={<DialogAlertButton onClick={onClose}>닫기</DialogAlertButton>}
    >
      <dl className="mt-4 flex flex-col gap-2 text-t6">
        {QUESTION_SHORTCUT_HELP.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-baseline justify-between gap-6">
            <dt className="text-secondary">{shortcut.keys}</dt>
            <dd>{shortcut.description}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
