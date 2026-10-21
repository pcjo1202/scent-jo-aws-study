import { ListHeader } from '@scent-jo/react'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import type { ExamResult } from '@aws-study/shared'

import { examReviewHref } from '@/shared/config/exam'

import { CELL_BASE_CLASS, GRID_CLASS, GRID_STYLE, THIN_BORDER_CELL_CLASS } from './grid-cell'

/**
 * DS에 semantic 테두리 색이 없어 danger 테두리를 글자색 토큰으로 칠한다. 토큰이 생기면
 * `border-danger`로 바꾼다 (scent-jo-ds#20, `graded-choice-item.tsx`의 success 테두리와 같은 우회).
 */
const DANGER_BORDER: CSSProperties = { borderColor: 'var(--sj-color-fg-danger)' }

/**
 * 칸의 세 상태 (`DESIGN.md` 「문제 이동 그리드」의 결과 표). **진행 중 그리드와 반대로
 * `success`·`danger`를 쓴다** — 그쪽이 그 둘을 금지한 근거는 「진행 중에는 정오를 표시하지
 * 않는다」이고, 세션이 끝나면 그 전제가 사라진다.
 *
 * **오답을 `danger` 채움으로 하지 않는다.** 그러면 정답과 면색으로만 갈려 흑백에서 구분이
 * 사라진다 (`DESIGN.md` 「색 단독 전달 금지」). **테두리(없음 / 굵음 / 얇음)** 가 셋을 가르고
 * 면 채움은 정답을 먼저 읽히게 하는 보조축이다.
 */
const CELL_STYLE: Record<CellState, { className: string; style?: CSSProperties }> = {
  correct: { className: 'border border-transparent bg-success-weak text-primary' },
  wrong: { className: 'border-2 text-primary', style: DANGER_BORDER },
  unanswered: { className: THIN_BORDER_CELL_CLASS },
}

const CELL_LABEL = {
  correct: '정답',
  wrong: '오답',
  unanswered: '미응답',
} as const

type CellState = keyof typeof CELL_LABEL

/** 미응답은 오답으로 채점되지만(`docs/02` 「종료 / 결과」) 화면에서는 가른다 — 다음에 할 일이 다르다. */
function toCellState(result: ExamResult): CellState {
  if (result.selected === null) return 'unanswered'

  return result.isCorrect ? 'correct' : 'wrong'
}

/**
 * 결과 화면의 문항별 리뷰 진입점 (`docs/02-features.md` 「결과 화면의 구성」).
 *
 * 진행 중 그리드(`QuestionGrid`)와 규격은 같고 **그릇이 다르다** — 시트도 패널도 아닌 본문
 * 안의 한 블록이라 열고 닫을 것이 없고, 그래서 결과 화면의 앱바 우측이 비어 있다. 칸이
 * 콜백이 아니라 링크인 것도 같은 이유다: 여기서 옮기는 것은 화면 안의 위치가 아니라 라우트다.
 *
 * 칸 규격과 열 배치는 진행 중 그리드와 같다 (`grid-cell.ts`). 제목과 줄의 좌우 여백은 같은
 * 화면의 `CategoryBars`와 맞춘다.
 */
export function ResultGrid({ results, sessionId }: { results: ExamResult[]; sessionId: string }) {
  const counts = { correct: 0, wrong: 0, unanswered: 0 }
  const states = results.map((result) => {
    const state = toCellState(result)
    counts[state] += 1

    return state
  })

  return (
    <section>
      <ListHeader
        size="small"
        verticalPadding="small"
        horizontalPadding="small"
        title={<ListHeader.TitleParagraph>문제별 리뷰</ListHeader.TitleParagraph>}
      />

      <ul className={`${GRID_CLASS} px-5`} style={GRID_STYLE}>
        {results.map((result, index) => {
          // `states`는 같은 배열의 `map` 결과라 길이가 같다.
          const state = states[index] as CellState
          const { className, style } = CELL_STYLE[state]
          const position = index + 1

          return (
            <li key={result.questionId}>
              <Link
                href={examReviewHref(sessionId, position)}
                aria-label={`${String(position)}번 문제 ${CELL_LABEL[state]}`}
                className={`${CELL_BASE_CLASS} ${className}`}
                style={style}
              >
                {position}
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="px-5 pt-3 text-t7 text-secondary">
        {counts.correct}문제 정답 · {counts.wrong}문제 오답
        {counts.unanswered > 0 && ` · ${String(counts.unanswered)}문제 미응답`}
      </p>
    </section>
  )
}
