import type { QuestionFilter } from '@/shared/lib/question-filter'

const ANSWER_COUNT_LABEL = { single: '단일정답', multiple: '복수정답' }
const SOLVE_STATE_LABEL = { unsolved: '안 푼 것', wrong: '오답', correct: '정답' }

/**
 * 지금 무엇이 걸려 있는지의 **표시**다. 필터 컨트롤이 아니다 — 눌러도 지워지지 않고, 해제는
 * 앱바 우측 `filter_list`로 패널을 열어서 한다 (`docs/02-features.md` 「화면 구성 요소」).
 *
 * 그래서 `secondary-container`가 아니라 **기본 면색**이다. 선택 상태를 나타낼 대상이 없다
 * (`DESIGN.md` 「칩」).
 *
 * 필터 결과가 0건일 때도 남는다 — 무엇 때문에 0건인지가 보여야 해제할지 고칠지를 정한다.
 */
export function AppliedFilterChips({ filter }: { filter: QuestionFilter }) {
  const labels = [
    ...filter.categories,
    ...filter.services,
    ...filter.answerCounts.map((kind) => ANSWER_COUNT_LABEL[kind]),
    ...filter.solveStates.map((state) => SOLVE_STATE_LABEL[state]),
  ]

  if (labels.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <li
          key={label}
          className="chip inline-flex items-center rounded-corner-full bg-surface-container-high px-3 text-label-medium text-on-surface-variant"
        >
          {label}
        </li>
      ))}
    </ul>
  )
}
