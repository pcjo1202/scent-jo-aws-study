import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { examsQuery } from '@/shared/api/exams'
import { progressQuery, statsQuery } from '@/shared/api/me'
import { getQueryClient } from '@/shared/api/query-client'
import { resolveApiUrl } from '@/shared/config/api-url'
import { AppBar } from '@/shared/ui/app-bar'
import { QueryBoundary } from '@/shared/ui/query-boundary'
import { StatusBanner } from '@/shared/ui/status-banner'

import { DashboardScreen } from './dashboard-screen'

const SCREEN_NAME = 'AWS SAA-C03 학습'

/**
 * 허브 (`docs/02-features.md` 「`/` 대시보드」).
 *
 * manifest·index는 `(app)/layout.tsx`의 `CatalogGate`가 이미 세워 뒀다. 여기서 세우는 경계는
 * 이 화면 고유의 api 조회 셋뿐이고, 그래서 문구도 학습 현황 쪽이다 — 두 경계를 합치면 진도
 * 5xx가 「문제 데이터를 불러오지 못했다」로 나간다.
 *
 * 셋은 서로를 모르므로 함께 띄운다.
 */
export async function HomePage() {
  const apiUrl = resolveApiUrl()

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(progressQuery(apiUrl)),
    queryClient.prefetchQuery(examsQuery(apiUrl)),
    queryClient.prefetchQuery(statsQuery(apiUrl)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueryBoundary
        pending={
          <>
            <AppBar title={SCREEN_NAME} />
            <div className="app-bar-gutter-top">
              <main className="mx-auto max-w-reading px-screen py-6">
                <StatusBanner kind="loading">불러오는 중…</StatusBanner>
              </main>
            </div>
          </>
        }
        errorMessage="학습 현황을 불러오지 못했다"
        canRetry
      >
        <DashboardScreen apiUrl={apiUrl} />
      </QueryBoundary>
    </HydrationBoundary>
  )
}
