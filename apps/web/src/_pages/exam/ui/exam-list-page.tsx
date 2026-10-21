import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examsQuery } from '@/shared/api/exams'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { ExamListScreen } from './exam-list-screen'

export const metadata = { title: '모의고사' }

/**
 * 세션 목록과 새 세션 시작 (`docs/02-features.md` 「`/exam` 모의고사 · 목록 화면」).
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * 이 화면 고유의 api 조회뿐이라 문구도 목록 쪽이다.
 *
 * **골격은 `frame`이 세운다.** 정상 경로의 골격은 `ExamListScreen`이 빈 상태와 목록에서 각각
 * 그리므로 경계를 그 안으로 넣을 수 없고, 경계가 골격 없이 서면 목록 5xx에서 앱바가 사라진다.
 */
export async function ExamListPage() {
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(examsQuery(apiUrl))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueryBoundary
        pending={<StatusBanner kind="loading">불러오는 중…</StatusBanner>}
        errorMessage="모의고사 목록을 불러오지 못했다"
        canRetry
        frame={{ title: '모의고사', backHref: '/' }}
      >
        <ExamListScreen apiUrl={apiUrl} />
      </QueryBoundary>
    </HydrationBoundary>
  )
}
