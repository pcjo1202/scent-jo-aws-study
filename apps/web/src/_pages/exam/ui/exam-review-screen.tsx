'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { manifestQuery, oneLinersQuery, questionIndexQuery } from '@/shared/api/cdn'
import { examQuery } from '@/shared/api/exams'
import { ActionBar } from '@/shared/ui/action-bar'
import { AppBar } from '@/shared/ui/app-bar'
import { Button } from '@/shared/ui/button'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { QuestionSlot } from '@/widgets/question-runner/ui/question-slot'

const SCREEN_NAME = '결과'

/**
 * 결과의 한 문항 (`docs/02-features.md` 「결과 화면의 구성」).
 *
 * **`/study` 채점 후와 같은 부품이다** — `QuestionSlot`에 서버가 준 판정을 넘기면 정답·해설·오답
 * 해설이 그대로 펼쳐진다. 화면이 다시 채점하지 않는다 (루트 `CLAUDE.md`).
 *
 * **읽기 전용이라 `onToggle`이 아무 일도 하지 않는다.** `QuestionRunner`는 `graded`가 있으면
 * 조작이 없는 `GradedChoiceList`를 그리므로 이 핸들러에 닿는 경로가 없다 — 넘기는 이유는 두
 * 모드가 한 컴포넌트이기 때문이지 여기에 쓸 자리가 있어서가 아니다.
 *
 * 단축키를 붙이지 않는다 — 푸는 화면이 아니고, 붙이면 `?` 도움말이 이 화면에 없는 「선택지
 * 고르기」·「제출」을 안내하게 된다 (`docs/02` 「키보드 조작」).
 */
export function ExamReviewScreen({
  apiUrl,
  sessionId,
  position,
}: {
  apiUrl: string
  sessionId: string
  /** URL의 1-based 위치. 세션의 `cursor`와 무관하다 — 종료된 세션의 `cursor`는 읽지 않는다. */
  position: number
}) {
  const router = useRouter()

  const { data: session } = useSuspenseQuery(examQuery(apiUrl, sessionId))
  const { data: manifest } = useSuspenseQuery(manifestQuery())
  const { data: index } = useSuspenseQuery(questionIndexQuery(manifest))
  const { data: oneLiners } = useSuspenseQuery(oneLinersQuery(manifest))

  const notes = useMemo(
    () => new Map(oneLiners.items.map((item) => [item.service, item.note])),
    [oneLiners],
  )

  const results = session.results
  // 세션의 `cursor`가 아니라 URL이 준 위치다. 이름을 나눠 둔다 — 종료된 세션의 `cursor`는
  // 아무도 읽지 않아야 하고(SJO-55), 같은 이름을 쓰면 다음 사람이 그 둘을 같은 것으로 읽는다.
  const result = results?.[position - 1]

  /**
   * 채점 전이거나 범위 밖 위치면 요약으로 보낸다. 요약은 채점 전 세션을 다시 `/exam/[id]`로
   * 넘기므로, 여기서 두 경우를 갈라 각각의 목적지를 정하지 않는다 — 판정을 한 곳에 둔다.
   */
  const isOutOfRange = result === undefined

  useEffect(() => {
    if (isOutOfRange) router.replace(`/exam/${sessionId}/result`)
  }, [isOutOfRange, router, sessionId])

  if (results === null || result === undefined) return null

  const entry = index.entries.find(({ id }) => id === result.questionId)
  if (!entry) {
    throw new Error(`인덱스에 문항 ${String(result.questionId)}이 없다`)
  }

  const total = results.length

  return (
    <>
      <AppBar
        title={`${SCREEN_NAME} ${position} / ${total}`}
        backHref={`/exam/${sessionId}/result`}
      />

      <div className="app-bar-gutter-top">
        <main className="action-bar-gutter mx-auto flex w-full min-w-0 max-w-reading flex-col gap-4 px-screen py-4">
          <QueryBoundary
            pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
            errorMessage="이 문제를 불러오지 못했다"
            canRetry
          >
            <QuestionSlot
              manifest={manifest}
              entry={entry}
              selected={result.selected ?? []}
              onToggle={() => undefined}
              graded={{ isCorrect: result.isCorrect, answer: result.answer }}
              notes={notes}
            />
          </QueryBoundary>
        </main>
      </div>

      {/*
        양 끝에서 비활성이고 숨기지 않는다 — 부재는 「그런 기능이 없다」로 읽히는데 이 화면은
        65문항을 오가며 읽는 곳이다 (`DESIGN.md` 「하단 액션의 버튼 배치」).
      */}
      <ActionBar>
        <Button
          variant="tonal"
          disabled={position <= 1}
          onClick={() => router.push(`/exam/${sessionId}/result/${String(position - 1)}`)}
        >
          이전
        </Button>
        <Button
          variant="filled"
          disabled={position >= total}
          onClick={() => router.push(`/exam/${sessionId}/result/${String(position + 1)}`)}
        >
          다음
        </Button>
      </ActionBar>
    </>
  )
}
