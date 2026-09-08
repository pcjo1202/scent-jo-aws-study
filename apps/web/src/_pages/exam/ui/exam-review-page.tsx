import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examQuery } from '@/shared/api/exams'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'

import { ExamReviewScreen } from './exam-review-screen'
import { ExamSessionBoundary } from './exam-session-boundary'

export const metadata = { title: '모의고사 결과' }

/**
 * 결과의 한 문항 (`docs/02-features.md` 「결과 화면의 구성」).
 *
 * **위치를 여기서 검증하지 않는다.** 숫자가 아니거나 범위 밖이면 `Number()`가 `NaN`을 주고
 * 화면이 요약으로 돌려보내는데, 그 판정은 세션의 문항 수를 알아야 하므로 조회 뒤에만 가능하다 —
 * 여기서 자릿수만 걸러 두면 「막았다」고 믿게 되는 반쪽 가드가 하나 더 생긴다.
 */
export async function ExamReviewPage({
  params,
}: {
  params: Promise<{ id: string; position: string }>
}) {
  const { id, position } = await params
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(examQuery(apiUrl, id))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ExamSessionBoundary title="모의고사 결과" backHref={`/exam/${id}/result`}>
        <ExamReviewScreen apiUrl={apiUrl} sessionId={id} position={Number(position)} />
      </ExamSessionBoundary>
    </HydrationBoundary>
  )
}
