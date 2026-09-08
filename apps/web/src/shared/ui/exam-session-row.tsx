import Link from 'next/link'

import type { ExamSessionSummary } from '@aws-study/shared'

import { EXAM_QUESTION_COUNT, examResultHref } from '@/shared/config/exam'
import { formatSessionDate } from '@/shared/lib/format-session-date'

/**
 * 「최근 모의고사」 행 규격 (`DESIGN.md` 「대시보드 요소」). 대시보드와 `/exam` 목록이 같은
 * 규격을 쓰고 **다른 것은 자를지 여부뿐**이다 — 대시보드는 최근 3개다 (`docs/02` 「목록 화면」).
 *
 * 최소 48px인 것은 누를 수 있기 때문이다. 누르면 그 세션의 결과로 간다.
 */
export function ExamSessionRow({ session }: { session: ExamSessionSummary }) {
  return (
    <Link
      href={examResultHref(session.id)}
      className="state-layer flex min-h-12 items-center justify-between gap-4 rounded-corner-small px-2 text-body-medium"
    >
      <span className="text-on-surface-variant">{formatSessionDate(session.startedAt)}</span>
      <ScoreCell score={session.score} />
    </Link>
  )
}

/**
 * 종료된 세션은 언제나 점수를 갖는다 — `finish`가 같은 문장에서 둘을 쓴다. 그래도 계약이
 * `null`을 허용하므로 자리를 비워 둔다: 없는 점수를 `0`으로 그리면 **0점 맞은 것으로 읽힌다.**
 */
function ScoreCell({ score }: { score: number | null }) {
  if (score === null) return <span className="text-on-surface-variant">—</span>

  return (
    <span>
      <span className="font-medium">{score}</span> / {EXAM_QUESTION_COUNT}
    </span>
  )
}
