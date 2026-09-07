'use client'

import type { ChoiceKey } from '@aws-study/shared'

import { SidePanel } from '@/shared/ui/side-panel'

/**
 * 칸의 세 상태 (`DESIGN.md` 「문제 이동 그리드」). **`correct`·`error`를 쓰지 않는다** — 진행
 * 중에는 정오를 표시하지 않으므로 답한 칸을 초록으로 칠하면 맞혔다는 뜻이 된다. 「답함」은
 * 정오가 아니라 **선택**이라 `secondary-container`다.
 *
 * 색을 잃어도 **테두리 유무와 두께**가 셋을 가른다 — 답함 투명 1px · 안 함 `outline` 1px ·
 * 현재 `outline` 2px. `outline-variant`가 아닌 이유는 그 저대비 경계가 패널 면 위에서 사실상
 * 안 보이기 때문이다.
 */
const CELL_CLASS = {
  answered: 'border border-transparent bg-secondary-container text-on-secondary-container',
  current: 'border-2 border-outline bg-surface-container-lowest text-on-surface',
  unanswered: 'border border-outline text-on-surface-variant',
} as const

/**
 * 문제 이동 그리드 (`docs/02-features.md` 「문항 간 자유롭게 이동할 수 있다」의 진입점).
 *
 * **열 수를 고정하지 않는다. 폭이 정한다** — 칸을 48px 아래로 내리면 탭 타깃을 어기는데
 * 320px 패널에서 6열은 38.7px이라 성립하지 않는다. 규칙은 열 수가 아니라 칸 크기이고
 * `.question-grid`가 `minmax(48px, 1fr)`로 그것을 건다 (`global.css`).
 *
 * 칸 안은 숫자뿐이다. 상태는 화면에서 테두리로 갈리고, 화면을 안 보는 사람에게는
 * `aria-label`이 말한다 (`DESIGN.md` 「색 단독 전달 금지」).
 */
export function QuestionGrid({
  questionIds,
  answers,
  cursor,
  isOpen,
  onClose,
  onJump,
}: {
  questionIds: number[]
  answers: Record<number, ChoiceKey[]>
  cursor: number
  isOpen: boolean
  onClose: () => void
  onJump: (position: number) => void
}) {
  const answeredCount = questionIds.filter((id) => (answers[id]?.length ?? 0) > 0).length

  return (
    <SidePanel label="문제 이동" isOpen={isOpen} onClose={onClose}>
      <ul className="question-grid">
        {questionIds.map((id, position) => {
          const isAnswered = (answers[id]?.length ?? 0) > 0
          const state = position === cursor ? 'current' : isAnswered ? 'answered' : 'unanswered'

          return (
            <li key={id}>
              <button
                type="button"
                aria-label={`${position + 1}번 문제 ${isAnswered ? '답함' : '안 함'}`}
                aria-current={position === cursor ? 'true' : undefined}
                onClick={() => {
                  onJump(position)
                  onClose()
                }}
                className={`state-layer flex w-full items-center justify-center rounded-corner-small text-label-medium ${CELL_CLASS[state]}`}
              >
                {position + 1}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-body-small text-on-surface-variant">
        {answeredCount}문제 답함 · {questionIds.length - answeredCount}문제 남음
      </p>
    </SidePanel>
  )
}
