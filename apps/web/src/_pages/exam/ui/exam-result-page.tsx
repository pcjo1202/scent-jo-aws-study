import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examQuery } from '@/shared/api/exams'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'

import { ExamResultScreen } from './exam-result-screen'
import { ExamSessionBoundary } from './exam-session-boundary'

export const metadata = { title: '모의고사 결과' }

/**
 * 종료된 세션의 점수·카테고리별 정오·문항별 리뷰 진입 (`docs/02-features.md` 「종료 / 결과」).
 *
 * 경계가 `QueryBoundary`가 아닌 이유는 `ExamSessionPage`와 같다 — 404와 5xx의 표현이 달라야
 * 하는데 그 컴포넌트는 한 벌을 미리 고르는 그릇이다.
 */
export async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(examQuery(apiUrl, id))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExamSessionBoundary title="모의고사 결과" backHref="/exam">
        <ExamResultScreen apiUrl={apiUrl} sessionId={id} />
      </ExamSessionBoundary>
    </HydrationBoundary>
  )
}
