'use client'

import type { ChoiceKey } from '@aws-study/shared'

import { PanelSheet, type PanelContainer } from '@/shared/ui/panel-sheet'

import { CELL_BASE_CLASS, GRID_STYLE } from './grid-cell'

/**
 * 칸의 세 상태 (`DESIGN.md` 「문제 이동 그리드」). **`success`·`danger`를 쓰지 않는다** — 진행
 * 중에는 정오를 표시하지 않으므로 답한 칸을 초록으로 칠하면 맞혔다는 뜻이 된다. 「답함」은
 * 정오가 아니라 **선택**이라 칩의 선택 상태와 같은 brand다.
 *
 * 색을 잃어도 **채움과 테두리 두께**가 셋을 가른다 — 답함 채움 · 현재 굵은 테두리 · 안 함 얇은
 * 테두리. 얇은 쪽이 `default`가 아니라 `strong`인 이유는 시트·사이드바 면 위에서도 보여야 하기
 * 때문이다. 현재 칸의 굵은 테두리는 글자색(`text-primary`)을 따른다 — `strong`으로 두면 두께만
 * 다른 옅은 선이라, 시트가 열릴 때 DS가 첫 칸에 그리는 포커스 링이 더 현재 칸처럼 보인다.
 */
const CELL_CLASS = {
  answered: 'border border-transparent bg-brand-weak text-brand',
  current: 'border-2 border-current text-primary',
  unanswered: 'border border-strong text-secondary',
} as const

/**
 * 문제 이동 그리드 (`docs/02-features.md` 「문항 간 자유롭게 이동할 수 있다」의 진입점).
 *
 * 칸 규격과 열 배치는 결과 그리드와 같다 (`grid-cell.ts`).
 *
 * 칸 안은 숫자뿐이다. 상태는 화면에서 테두리로 갈리고, 화면을 안 보는 사람에게는
 * `aria-label`이 말한다 (`DESIGN.md` 「색 단독 전달 금지」).
 */
export function QuestionGrid({
  questionIds,
  answers,
  cursor,
  onJump,
  ...panel
}: PanelContainer & {
  questionIds: number[]
  answers: Record<number, ChoiceKey[]>
  cursor: number
  onJump: (position: number) => void
}) {
  const answeredCount = questionIds.filter((id) => (answers[id]?.length ?? 0) > 0).length

  const content = (
    <>
      <ul className="grid gap-2" style={GRID_STYLE}>
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
                  if (panel.container === 'sheet') panel.onClose()
                }}
                className={`${CELL_BASE_CLASS} ${CELL_CLASS[state]}`}
              >
                {position + 1}
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-t7 text-secondary">
        {answeredCount}문제 답함 · {questionIds.length - answeredCount}문제 남음
      </p>
    </>
  )

  if (panel.container === 'sidebar') {
    return (
      <section aria-label="문제 이동" className="flex flex-col gap-6 p-6">
        {content}
      </section>
    )
  }

  return (
    <PanelSheet label="문제 이동" isOpen={panel.isOpen} onClose={panel.onClose}>
      {content}
    </PanelSheet>
  )
}
