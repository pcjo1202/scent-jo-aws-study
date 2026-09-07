import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examsQuery } from '@/shared/api/exams'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'
import { AppBar } from '@/shared/ui/app-bar'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { ExamListScreen } from './exam-list-screen'

export const metadata = { title: '모의고사' }

/**
 * 세션 목록과 새 세션 시작 (`docs/02-features.md` 「`/exam` 모의고사 · 목록 화면」).
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * 이 화면 고유의 api 조회뿐이라 문구도 목록 쪽이다.
 */
export async function ExamListPage() {
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(examsQuery(apiUrl))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueryBoundary
        pending={
          <>
            <AppBar title="모의고사" backHref="/" />
            <div className="app-bar-gutter-top">
              <main className="mx-auto max-w-reading px-screen py-6">
                <StatusBanner kind="loading">불러오는 중…</StatusBanner>
              </main>
            </div>
          </>
        }
        errorMessage="모의고사 목록을 불러오지 못했다"
        canRetry
      >
        <ExamListScreen apiUrl={apiUrl} />
      </QueryBoundary>
    </HydrationBoundary>
  )
}
