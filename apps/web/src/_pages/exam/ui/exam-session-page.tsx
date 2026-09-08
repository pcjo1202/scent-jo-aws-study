import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examQuery } from '@/shared/api/exams'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'

import { ExamSessionBoundary } from './exam-session-boundary'
import { ExamSessionScreen } from './exam-session-screen'

export const metadata = { title: '모의고사' }

/**
 * 65문항을 정오를 모른 채 푼다 (`docs/02-features.md` 「`/exam` 모의고사 · 진행」).
 *
 * 경계를 `QueryBoundary`가 아니라 `ExamSessionBoundary`가 세운다 — 이 화면은 404와 5xx의
 * 표현이 달라야 하는데(목록으로 돌려보내기 / 다시 시도) `QueryBoundary`는 한 벌을 미리
 * 고르는 그릇이다. 그 천장은 `query-boundary.tsx` 주석에 적혀 있고, 갈라야 하는 화면은
 * 직접 분기하라고 한다.
 */
export async function ExamSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(examQuery(apiUrl, id))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExamSessionBoundary title="모의고사" backHref="/exam">
        <ExamSessionScreen apiUrl={apiUrl} sessionId={id} />
      </ExamSessionBoundary>
    </HydrationBoundary>
  )
}
