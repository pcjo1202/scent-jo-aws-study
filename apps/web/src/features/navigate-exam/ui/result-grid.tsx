import Link from 'next/link'

import type { ExamResult } from '@aws-study/shared'

import { examReviewHref } from '@/shared/config/exam'

/**
 * 칸의 세 상태 (`DESIGN.md` 「문제 이동 그리드」의 결과 표). **진행 중 그리드와 반대로
 * `correct`·`error`를 쓴다** — 그쪽이 그 둘을 금지한 근거는 「진행 중에는 정오를 표시하지
 * 않는다」이고, 세션이 끝나면 그 전제가 사라진다.
 *
 * **오답을 `error-container` 채움으로 하지 않는다.** 그러면 정답과 면색으로만 갈려 흑백에서
 * 구분이 사라진다 (`DESIGN.md` 「색 단독 전달 금지」). 면 채움 하나를 테두리로 바꾸면
 * **면(채움/없음) × 테두리(없음/2px/1px)** 두 축이 되어 셋이 분리된다.
 */
const CELL_CLASS = {
  correct: 'border border-transparent bg-correct-container text-on-correct-container',
  wrong: 'border-2 border-error text-on-surface',
  unanswered: 'border border-outline text-on-surface-variant',
} as const

const CELL_LABEL = {
  correct: '정답',
  wrong: '오답',
  unanswered: '미응답',
} as const

type CellState = keyof typeof CELL_CLASS

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
 * **열 수를 고정하지 않는다. 폭이 정한다** — `.question-grid`가 `minmax(48px, 1fr)`로 칸
 * 크기를 걸고 열 수는 그 결과다 (`global.css`).
 */
export function ResultGrid({ results, sessionId }: { results: ExamResult[]; sessionId: string }) {
  const counts = { correct: 0, wrong: 0, unanswered: 0 }
  const states = results.map((result) => {
    const state = toCellState(result)
    counts[state] += 1

    return state
  })

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title-small">문제별 리뷰</h2>

      <ul className="question-grid grid gap-2">
        {results.map((result, index) => {
          // `states`는 같은 배열의 `map` 결과라 길이가 같다.
          const state = states[index] as CellState
          const position = index + 1

          return (
            <li key={result.questionId}>
              <Link
                href={examReviewHref(sessionId, position)}
                aria-label={`${String(position)}번 문제 ${CELL_LABEL[state]}`}
                className={`state-layer flex min-h-12 w-full items-center justify-center rounded-corner-small text-label-medium ${CELL_CLASS[state]}`}
              >
                {position}
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="text-body-small text-on-surface-variant">
        {counts.correct}문제 정답 · {counts.wrong}문제 오답
        {counts.unanswered > 0 && ` · ${String(counts.unanswered)}문제 미응답`}
      </p>
    </section>
  )
}
